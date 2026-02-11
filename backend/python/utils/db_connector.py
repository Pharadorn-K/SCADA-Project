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
    
def row_after_output(_db_pool,time_stamp,department,machine_name,part_name):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT time_stamp,output_,idle_,alarm_,offline_
            FROM raw_press
            WHERE id_row >=(
                SELECT id_row
                FROM raw_press
                WHERE DATE(time_stamp) = DATE(%s) AND department_ = %s AND machine_name = %s AND part_name = %s AND output_ = %s
                ORDER BY time_stamp DESC
                LIMIT 1
                ) AND DATE(time_stamp) = DATE(%s) AND department_ = %s AND machine_name = %s AND part_name = %s
            ORDER BY time_stamp ASC
        """
    elif department == "Heat":
        query = """
            SELECT time_stamp,output_,idle_,setting_,alarm_,offline_
            FROM raw_heat
            WHERE id_row >=(
                SELECT id_row
                FROM raw_heat
                WHERE DATE(time_stamp) = DATE(%s) AND department_ = %s AND machine_name = %s AND part_name = %s AND output_ = %s
                ORDER BY time_stamp DESC
                LIMIT 1
                ) AND DATE(time_stamp) = DATE(%s) AND department_ = %s AND machine_name = %s AND part_name = %s
            ORDER BY time_stamp ASC
        """        
    cursor = conn.cursor()
    cursor.execute(query,(time_stamp,department,machine_name,part_name,1,time_stamp,department,machine_name,part_name))
    row = cursor.fetchall()  
    cursor.close()
    conn.close()
    return row

if __name__ == "__main__":
    try:
        db_pool = create_pool()
        row = row_after_output(db_pool,'2025-03-18 10:23:14.22','Heat','DKK2','KVB 1C2M 1STAP          ')
        status_count_check = datetime.now()
        db_time = row[0]["time_stamp"]

        if isinstance(db_time, str):
            db_time = datetime.strptime(db_time, "%Y-%m-%d %H:%M:%S.%f")

        cycle_time = (status_count_check - db_time).total_seconds()
        print(cycle_time)

    except Exception as e:
        print(f"{e}")