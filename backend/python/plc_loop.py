# backend/python/plc_loop.py

import pymcprotocol
import time
import threading
from datetime import datetime
from queue import Full, Queue, Empty
import sys

try:
    # Prefer relative import when running as a package
    from .utils import db_writer
    from .utils import clean_data
    from .utils import db_connector
except Exception:
    # Fall back to direct import when running as a script
    from utils import db_writer
    from utils import clean_data
    from utils import db_connector

# Global state (consider encapsulating in a class later if needed)
_command_queue = Queue()  # Thread-safe queue for write commands
mc = None
_running = False
_plc_location = None
_read_config = None
_socket_clients = []  # List of (socket, addr) to broadcast to
raw_bit_data = []
raw_word_data = []
STOP = object()
main_q_intersection = Queue(maxsize=5000)
press_clean_q = Queue(maxsize=1000)
heat_clean_q = Queue(maxsize=1000)
lathe_clean_q = Queue(maxsize=1000)
eq_press_clean_q = Queue(maxsize=1000)

clean_db_q = Queue(maxsize=1000)
_db_pool = None

_db_pool = db_connector.create_pool()
plc_location = clean_data.get_all_location(_db_pool,"PLC")
status_location = clean_data.get_all_location(_db_pool,"Read_location")
all_range = clean_data.get_all_location(_db_pool,"All")
all_range_equipment = clean_data.get_all_location(_db_pool,"Equipment")
all_department,all_machine,all_data,all_category = clean_data.get_range(all_range)
all_department_eq,all_machine_eq,all_category_eq,all_data_eq = clean_data.get_range_equipment(all_range_equipment)

# --- read head & size function ---
def get_read_head_and_size():
    pool = db_writer.get_db_pool()
    if pool is None:
        print("⚠️ DB pool not available. Skipping save.")
        return False

    try:
        conn = pool.connection()
        cursor = conn.cursor()


        cursor.execute("""""")

        cursor.close()
        # conn.close() not needed; returned to pool automatically
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False

def connect_to_plc():
    """
    Attempt to connect to PLC with fallback ports.
    
    Returns:
        bool: True if connection successful, False otherwise
    """
    global mc
    
    # Close existing connection
    if mc is not None:
        try:
            mc.close()
        except Exception:
            pass
    
    # Try each port in the location config
    ports_to_try = _plc_location[1:4]  # indices 1, 2, 3
    
    for port in ports_to_try:
        try:
            mc = pymcprotocol.Type3E()
            mc.connect(_plc_location[0], port)
            print(f"✅ Connected to PLC {_plc_location[0]}:{port}")
            return True
        except Exception as e:
            print(f"⚠️ Connection attempt to port {port} failed: {e}")
            continue
    
    # All connection attempts failed
    print(f"❌ Failed to connect to PLC after trying ports: {ports_to_try}")
    mc = None
    return False

def start_loop(plc_location, read_config, socket_clients_list):
    """
    Start the PLC polling loop in a background thread.
    Called by plc_service.py
    """
    global _running, _plc_location, _read_config, _socket_clients, press_clean_q, heat_clean_q, lathe_clean_q, eq_press_clean_q, clean_db_q, STOP
    _plc_location = plc_location
    _read_config = read_config
    _socket_clients = socket_clients_list
    _running = True

    # Start background thread
    loop_read_PLC_thread = threading.Thread(target=_loop_read_plc_worker, daemon=True)
    loop_read_PLC_thread.start()
    loop_main_queue_thread = threading.Thread(target=_main_queue_intersection, daemon=True)
    loop_main_queue_thread.start()
    loop_press_clean_thread = threading.Thread(target=_loop_clean_press_data_worker, daemon=True)
    loop_press_clean_thread.start()
    # loop_heat_clean_thread = threading.Thread(target=_loop_clean_heat_data_worker, daemon=True)
    # loop_heat_clean_thread.start()
    # loop_lathe_clean_thread = threading.Thread(target=_loop_clean_lathe_data_worker, daemon=True)
    # loop_lathe_clean_thread.start()
    # loop_eq_press_clean_thread = threading.Thread(target=_loop_clean_eq_press_data_worker, daemon=True)
    # loop_eq_press_clean_thread.start()
    loop_write_DB_thread = threading.Thread(target=_loop_writer_db_worker, daemon=True)
    loop_write_DB_thread.start()
    return True

def stop_loop():
    """Stop the loop gracefully."""
    global STOP,_running
    _running = False      


def write_tag(tag, value):
    """
    Enqueue a write command. Format: e.g., tag="B100", value=1
    Called from plc_service.py (TCP command handler)
    """
    # Use consistent keys for the queued command
    _command_queue.put({"tag": tag, "value": value})
    print(f"➕ Enqueued write command: {tag} = {value}")

def _process_write_commands():
    """Process all pending write commands."""
    while not _command_queue.empty():
        try:
            cmd = _command_queue.get_nowait()
            tag = cmd["tag"]
            value = cmd["value"]

            if mc is None:
                print("⚠️ Cannot write: PLC not connected")
                continue

            try:
                if tag.startswith("B") or tag.startswith("X") or tag.startswith("Y"):
                    # Bit write
                    device = tag[0]
                    offset = int(tag[1:])
                    mc.randomwrite_bitunits(
                        writedata=[value],
                        device=device,
                        headdevice=offset
                    )
                elif tag.startswith("W") or tag.startswith("D"):
                    # Word write
                    device = tag[0]
                    offset = int(tag[1:])
                    mc.randomwrite_wordunits(
                        writedata=[value],
                        device=device,
                        headdevice=offset
                    )
                else:
                    print(f"❓ Unknown tag format: {tag}")
                print(f"✍️ Wrote {tag} = {value}")
            except Exception as e:
                print(f"❌ Write error: {e}")
        except Empty:
            break

def _loop_read_plc_worker():
    """Main read loop."""
    global mc
    connected = False

    while _running:
        if not connected:
            connected = connect_to_plc()
            if not connected:
                time.sleep(5)  # Retry every 5s if disconnected
                continue

        try:
            # Process any pending writes
            _process_write_commands()
            raw_bit_data.clear()
            raw_word_data.clear()
            
            # Read data
            bit_head, bit_size, word_head_a, word_head_b, word_head_c, word_head_d, word_head_e, word_head_f, word_head_g, word_size = _read_config
            word_head = (word_head_a, word_head_b, word_head_c, word_head_d, word_head_e, word_head_f, word_head_g)

            raw_bit_data.extend(mc.batchread_bitunits(headdevice=bit_head, readsize=bit_size))

            for wh in word_head:
                raw_word_data.extend(mc.batchread_wordunits(headdevice=wh, readsize=word_size))

            timestamp = datetime.now().isoformat()
            bit_data = raw_bit_data.copy()
            word_data = raw_word_data.copy()

            tags = (timestamp, bit_data, word_data)

            # tags = {
            #     "timestamp": timestamp,
            #     "bits": bit_data,
            #     "words": word_data,
            #     # Optional: map to named tags like "motor_on", "temp"
            # }

            # 1. Send data to Queue for Clean
            main_q_intersection.put(tags , timeout=1)

            # 2. Broadcast to all connected Node.js clients
            # _broadcast_plc_data(tags)
            time.sleep(5)  # 0.3-second loop

        except Exception as e:
            print(f"⚠️ Read error, reconnecting: {e}")
            connected = False
            try:
                mc.close()
            except:
                pass
            mc = None
            time.sleep(0.3)

    # Cleanup on exit
    if mc:
        mc.close()
        print("🛑 PLC loop stopped")
        main_q_intersection.put_nowait(STOP)
    else:
        print("🛑 PLC loop stopped, ⚠️ Error mc")

def _main_queue_intersection():
    while True:
        data = main_q_intersection.get()        
        try:
            if data is STOP:
                for sq in [press_clean_q, heat_clean_q, lathe_clean_q, eq_press_clean_q]:
                    sq.put_nowait(STOP)
                print("🛑 Main intersection stopped By STOP")
                break

            for q in [press_clean_q, heat_clean_q, lathe_clean_q, eq_press_clean_q]:
                try:
                    q.put(data, timeout=1)
                except Full:
                    print(f"⚠️ Queue full {q}, drop data")
        finally:
            main_q_intersection.task_done()
        time.sleep(0.3)

def _loop_clean_press_data_worker():
    while True :
        data = press_clean_q.get() 
        try:
            if data is STOP:
                clean_db_q.put_nowait(STOP)
                print("🛑 Clean press data loop stopped By STOP")
                break
            cleaned_press = clean_data.press_clean(_db_pool,all_department,all_machine,all_data,data)
            # Pass to DB writer queue
            clean_broadcast = {"status": cleaned_press[0],
                                "count": cleaned_press[1],
                                "cycle_time": cleaned_press[2]
                               }
            _broadcast_plc_data(clean_broadcast)
            # clean_db_q.put(cleaned_press, timeout=1)
        finally:
            press_clean_q.task_done()
        time.sleep(0.2)

# --- Get connection pool ---
def get_db_pool():
    global _db_pool
    if _db_pool is None:
        _db_pool = db_connector.create_pool()
    return _db_pool
def _loop_writer_db_worker():
    """Worker thread to write PLC data to DB."""
    global _db_pool    
    while True :
        data = clean_db_q.get()
        try:
            if data is STOP:
                print("🛑 DB writer loop stopped By STOP")
                break

            if _db_pool is None:
                print("to write but _db_pool is None",_db_pool)
                _db_pool = get_db_pool()
                if _db_pool is None:
                    print("⚠️ DB pool not available. Skipping save.")
                    return False
                elif _db_pool is not None:
                    print("✅ recreated DB pool complete.")
            else:
                print("✅ DB pool available.")

            success = db_writer.save_plc_data(_db_pool,data)

            if not success:
                print("❌ Failed to save PLC data to DB")

        finally:
            clean_db_q.task_done()
        time.sleep(0.5)
# --- Broadcast function ---
def _broadcast_plc_data(data):
    """Send JSON data to all connected TCP clients (Node.js)."""
    message = '{"type": "plc_data", "tags": ' + str(data).replace("'", '"') + '}'
    # Safer: use json.dumps
    # import json
    # message = json.dumps({"type": "plc_data", "tags": data}) + ""

    dead_clients = []
    for client_sock, addr in _socket_clients[:]:
        try:
            client_sock.send(message.encode('utf-8'))
        except Exception as e:
            print(f"🔌 Client {addr} disconnected: {e}")
            dead_clients.append((client_sock, addr))

    # Remove dead clients
    for dead in dead_clients:
        _socket_clients.remove(dead)
