# backend/python/plc_service.py
import socket
import threading
import json
import sys
from datetime import datetime
from dotenv import load_dotenv
import os
try:
    # Use package relative import when this module is part of a package
    from . import plc_loop
except Exception:
    # Fallback to top-level import when running as a script: python plc_service.py
    try:
        import plc_loop
    except Exception:
        # As a last resort, try to adjust path and import
        import os
        sys.path.insert(0, os.path.dirname(__file__))
        import plc_loop
# At top of plc_service.py
load_dotenv(dotenv_path="../node/.env")

PLC_IP = os.getenv("PLC_IP")
PLC_PORT_A = int(os.getenv('PLC_PORT_A'))
PLC_PORT_B = int(os.getenv('PLC_PORT_B'))
PLC_PORT_C = int(os.getenv('PLC_PORT_C'))

TCP_HOST = os.getenv("TCP_HOST")
TCP_PORT = int(os.getenv("TCP_PORT"))
# READ_CONFIG = ["B0", 7168, "W0", 960]  # [bit_head, bit_size, word_head, word_size]

READ_CONFIG = [
    os.getenv("BIT_HEAD"),
    int(os.getenv('BIT_SIZE')), 
    os.getenv("WORD_HEAD_A"), 
    os.getenv("WORD_HEAD_B"), 
    os.getenv("WORD_HEAD_C"),
    os.getenv("WORD_HEAD_D"),
    os.getenv("WORD_HEAD_E"),
    os.getenv("WORD_HEAD_F"),
    os.getenv("WORD_HEAD_G"),
    int(os.getenv("WORD_SIZE"))
    ]
# List of connected Node.js clients (socket, address)
connected_clients = []

def handle_client(client_socket, addr):
    """Handle a single Node.js client connection."""
    print(f"📥 New connection from {addr}")
    connected_clients.append((client_socket, addr))

    try:
        buffer = ""
        while True:
            data = client_socket.recv(1024)
            if not data:
                break
            buffer += data.decode('utf-8')

            # Handle line-by-line JSON messages (split by \n)
            while '\n' in buffer:
                line, buffer = buffer.split('\n', 1)
                line = line.strip()
                if not line:
                    continue

                try:
                    msg = json.loads(line)
                    handle_command(msg, client_socket)
                except json.JSONDecodeError as e:
                    print(f"❌ Invalid JSON from {addr}: {line} | Error: {e}")
    except ConnectionResetError:
        pass
    except Exception as e:
        print(f"⚠️ Client {addr} error: {e}")
    finally:
        print(f"📤 Client {addr} disconnected")
        if (client_socket, addr) in connected_clients:
            connected_clients.remove((client_socket, addr))
        client_socket.close()


def handle_command(msg, client_socket):
    """Process commands from Node.js."""
    cmd = msg.get("cmd")

    if cmd == "start":
        print("▶️ Start command received")
        success = plc_loop.start_loop(
            plc_location=(PLC_IP, PLC_PORT_A, PLC_PORT_B, PLC_PORT_C),
            read_config=READ_CONFIG,
            socket_clients_list=connected_clients,
        )
        # Send ACK back
        response = {"type": "ack", "cmd": "start", "success": success}
        client_socket.send((json.dumps(response) + "\n").encode('utf-8'))

    elif cmd == "stop":
        print("⏹️ Stop command received")
        plc_loop.stop_loop()
        # Send ACK back
        response = {"type": "ack", "cmd": "stop", "success": True}
        client_socket.send((json.dumps(response) + "\n").encode('utf-8'))

    elif cmd == "write":
        tag = msg.get("tag")
        value = msg.get("value")
        if tag is None or value is None:
            print("❌ Write command missing 'tag' or 'value'")
            return
        print(f"📝 Write command: {tag} = {value}")
        plc_loop.write_tag(tag, value)
        # After successful write
        response = {"type": "ack", "cmd": "write", "tag": tag, "success": True}
        client_socket.send((json.dumps(response) + "\n").encode('utf-8'))
    else:
        print(f"❓ Unknown command: {cmd}")


def start_tcp_server():
    """Start the TCP command server."""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        server.bind((TCP_HOST, TCP_PORT))
        server.listen(5)
        print(f"📡 Python PLC service listening on {TCP_HOST}:{TCP_PORT}")
    except OSError as e:
        print(f"❌ Failed to bind to {TCP_HOST}:{TCP_PORT}: {e}")
        sys.exit(1)

    try:
        while True:
            client_sock, addr = server.accept()
            client_handler = threading.Thread(
                target=handle_client,
                args=(client_sock, addr),
                daemon=True
            )
            client_handler.start()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down PLC service...")
    finally:
        plc_loop.stop_loop()
        server.close()


if __name__ == "__main__":
    print(f"🚀 Starting SCADA PLC Service | {datetime.now().isoformat()}")
    start_tcp_server()