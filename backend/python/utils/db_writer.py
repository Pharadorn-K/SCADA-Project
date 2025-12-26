# backend/python/utils/db_writer.py

import os
import json
from datetime import datetime
from pathlib import Path


# --- Save function ---
def save_plc_data(_db_pool,data):

    try:
        conn = _db_pool.connection()
        cursor = conn.cursor()
        
        received, cycle_time, count_today =data
        query = "INSERT INTO pc_press_2 (time_stamp, department_, category_, machine_name, part_name, plan_, id_operator, output_, cycle_time, count_, run_, idle_, alarm_, offline_, alarm_code) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
        cursor.execute(query, ( received[0], received[1], received[3], received[2], received[4], received[5], received[6], received[7], cycle_time, count_today, received[8], received[9], received[10],  received[11], received[12]))            

        # Convert lists to JSON strings (MySQL JSON type accepts str)
        # bits_json = json.dumps(data["bits"])
        # words_json = json.dumps(data["words"])
        # raw_json = json.dumps(data)

        # cursor.execute("""
        #     INSERT INTO plc_test (timestamp, bits_json, words_json, raw_json)
        #     VALUES (%s, %s, %s, %s)
        # """, (
        #     data["timestamp"],  # ISO string → MySQL DATETIME
        #     bits_json,
        #     words_json,
        #     raw_json
        # ))

        print("writed DB data",data)
        cursor.close()
        conn.close() # not needed; returned to pool automatically
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False