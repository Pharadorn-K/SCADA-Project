from pathlib import Path
import os
from dbutils.pooled_db import PooledDB
import pymysql
from dotenv import load_dotenv
from datetime import datetime

# --- Load config ---
env_path = Path(__file__).parent.parent.parent / "node" / ".env"
load_dotenv(dotenv_path=env_path)

# --- Create connection pool ---
def create_pool():
    try:
        pool = PooledDB(
            creator=pymysql,
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT")),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            mincached=int(os.getenv("DB_MIN", 1)),
            maxcached=int(os.getenv("DB_MAX", 5)),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True  # Important: auto-commit INSERTs
        )
        print("✅ MySQL connection pool created")
        return pool
    except Exception as e:
        print(f"❌ Failed to create DB pool: {e}")
        return None

# --- Count production ---
def count_production(_db_pool,timestamp,department,machine,part_name):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_press
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND part_name = %s AND count_signal = %s
        """
    elif department == "Heat":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_heat
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND part_name = %s AND count_signal = %s
        """
    elif department == "Lathe":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_lathe
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND part_name = %s AND count_signal = %s
        """
    cursor = conn.cursor()
    cursor.execute(query, (timestamp,department,machine,part_name,1))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result['count_output'] if result and 'count_output' in result else 0
from datetime import datetime, time, timedelta
# --- Count current shift ---
def get_shift_range(current_dt):
    t = current_dt.time()

    shift_a_start = time(6, 0)
    shift_b_start = time(14, 0)
    shift_c_start = time(22, 0)

    if shift_a_start <= t < shift_b_start:
        shift = "A"
        start = current_dt.replace(hour=6, minute=0, second=0, microsecond=0)
        end = current_dt.replace(hour=14, minute=0, second=0, microsecond=0)

    elif shift_b_start <= t < shift_c_start:
        shift = "B"
        start = current_dt.replace(hour=14, minute=0, second=0, microsecond=0)
        end = current_dt.replace(hour=22, minute=0, second=0, microsecond=0)

    else:
        shift = "C"
        start = current_dt.replace(hour=22, minute=0, second=0, microsecond=0)

        # ถ้าเป็นหลังเที่ยงคืน ต้องย้อนวัน
        if t < shift_a_start:
            start = start - timedelta(days=1)

        end = start + timedelta(hours=8)

    return shift, start, end
def count_current_shift(_db_pool, timestamp, department, machine):
    conn = _db_pool.connection()
    current_dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S.%f")

    shift, start_time, end_time = get_shift_range(current_dt)

    table_map = {
        "Press": "raw_press",
        "Heat": "raw_heat",
        "Lathe": "raw_lathe"
    }

    table_name = table_map.get(department)
    if not table_name:
        return 0

    query = f"""
        SELECT COUNT(count_signal) AS count_output
        FROM {table_name}
        WHERE timestamp >= %s
        AND timestamp < %s
        AND department = %s
        AND machine = %s
        AND count_signal = 1
    """

    cursor = conn.cursor()
    cursor.execute(query, (start_time, end_time, department, machine))
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    return result['count_output'] if result else 0
# --- Row after output ---
def row_after_output(_db_pool,timestamp,department,machine_name,part_name):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT timestamp,count_signal,idle,alarm,offline
            FROM raw_press
            WHERE id_row >=(
                SELECT id_row
                FROM raw_press
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC
            LIMIT 10
        """
    elif department == "Heat":
        query = """
            SELECT timestamp,count_signal,idle,setting,alarm,offline
            FROM raw_heat
            WHERE id_row >=(
                SELECT id_row
                FROM raw_heat
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC
            LIMIT 10
        """ 
    elif department == "Lathe":
        query = """
            SELECT timestamp,count_signal,idle,alarm,offline
            FROM raw_lathe
            WHERE id_row >=(
                SELECT id_row
                FROM raw_lathe
                WHERE DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s AND count_signal = %s
                ORDER BY timestamp DESC
                LIMIT 1
                ) AND DATE(timestamp) = DATE(%s) AND department = %s AND machine = %s AND part_name = %s
            ORDER BY timestamp ASC 
            LIMIT 10
        """  
    cursor = conn.cursor()
    cursor.execute(query,(timestamp,department,machine_name,part_name,1,timestamp,department,machine_name,part_name))
    row = cursor.fetchall()  
    cursor.close()
    conn.close()
    return row

if __name__ == "__main__":
    try:
        db_pool = create_pool()
        row = row_after_output(
            db_pool,
            '2026-02-19 09:13:51.11',
            'Press',
            'AIDA630T',
            '45351-KVB-S020-M2'
            )
        # row = count_current_shift(
        #     db_pool,
        #     '2026-02-18 15:00:00.00',
        #     'Heat',
        #     'DKK2'
        # )
        print(row)

    except Exception as e:
        print(f"{e}")