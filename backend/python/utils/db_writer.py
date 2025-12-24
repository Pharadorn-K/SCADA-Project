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
# get_db_pool() 
# save_plc_data({"test":"data"})