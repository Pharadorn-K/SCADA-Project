# backend/python/utils/db_writer.py
import os
import json
from datetime import datetime
from pathlib import Path

# --- Save function ---  
def save_press_data(_db_pool,data):
    return True
    try:
        conn = _db_pool.connection()
        cursor = conn.cursor()

        query = "INSERT INTO raw_press (event, source, department, machine, machine_type, timestamp, part_name, plan, operator_id, count_signal, cycle_time, count_today, run, idle, alarm, offline, alarm_code ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
        cursor.execute(query, ( ))            

        cursor.close()
        conn.close() # not needed; returned to pool automatically
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False
    
def save_heat_data(_db_pool,data):
    # print("save_heat_data",data)
    return True
    try:
        conn = _db_pool.connection()
        cursor = conn.cursor()
        
        received, cycle_time, count_today =data
        query = "INSERT INTO raw_heat (time_stamp, department_, category_, machine_name, part_name, plan_, id_operator, output_, cycle_time, count_, run_, idle_, alarm_, offline_, alarm_code) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
        cursor.execute(query, ( received[0], received[1], received[3], received[2], received[4], received[5], received[6], received[7], cycle_time, count_today, received[8], received[9], received[10],  received[11], received[12]))            

        print("writed DB data",data)
        cursor.close()
        conn.close() # not needed; returned to pool automatically
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False
    
def save_lathe_data(_db_pool,data):
    # print("save_lathe_data",data)
    return True