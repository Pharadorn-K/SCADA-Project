# backend/python/utils/db_writer.py
import os
import json
from datetime import datetime
from pathlib import Path

# --- fatten data ---
def flatten_press_event(data):
    return {
        "event": data["event"],
        "source": data["source"],
        "department": data["department"],
        "machine": data["machine"],
        "machine_type": data["machine_type"],
        "timestamp": data["timestamp"],
        "part_name": data["context"]["part_name"],
        "plan": data["context"]["plan"],
        "operator_id": data["context"]["operator_id"],
        "count_signal": data["metrics"]["count_signal"],
        "run": data["metrics"]["run"],
        "idle": data["metrics"]["idle"],
        "alarm": data["metrics"]["alarm"],
        "offline": data["metrics"]["offline"],
        "alarm_code": data["metrics"]["alarm_code"],
        "cycle_time": data["metrics"]["cycle_time"],
        "count_shift": data["metrics"]["count_shift"],
    }
def flatten_heat_event(data):
    return {
        "event": data["event"],
        "source": data["source"],
        "department": data["department"],
        "machine": data["machine"],
        "machine_type": data["machine_type"],
        "timestamp": data["timestamp"],
        "part_name": data["context"]["part_name"],
        "plan": data["context"]["plan"],
        "operator_id": data["context"]["operator_id"],
        "run": data["metrics"]["run"],     
        "heat": data["metrics"]["heat"],   
        "count_signal": data["metrics"]["count_signal"],
        "idle": data["metrics"]["idle"],
        "setting": data["metrics"]["setting"],
        "alarm": data["metrics"]["alarm"],
        "offline": data["metrics"]["offline"],
        "alarm_code": data["metrics"]["alarm_code"],
        "cycle_time": data["metrics"]["cycle_time"],
        "count_shift": data["metrics"]["count_shift"],
    }
def flatten_lathe_event(data):
    return {
        "event": data["event"],
        "source": data["source"],
        "department": data["department"],
        "machine": data["machine"],
        "machine_type": data["machine_type"],
        "timestamp": data["timestamp"],
        "part_name": data["context"]["part_name"],
        "plan": data["context"]["plan"],
        "operator_id": data["context"]["operator_id"],
        "count_signal": data["metrics"]["count_signal"],
        "run": data["metrics"]["run"],
        "idle": data["metrics"]["idle"],
        "alarm": data["metrics"]["alarm"],
        "offline": data["metrics"]["offline"],
        "alarm_code": data["metrics"]["alarm_code"],
        "cycle_time": data["metrics"]["cycle_time"],
        "count_shift": data["metrics"]["count_shift"],
    }

# --- Save function ---  
def save_press_data(_db_pool, data):
    # return True
    try:

        conn = _db_pool.connection()
        cursor = conn.cursor()
        flatten_data = flatten_press_event(data)
        query = """
        INSERT INTO raw_press (
            event, source, department, machine, machine_type, timestamp,
            part_name, plan, operator_id,
            count_signal, run, idle, alarm, offline,
            alarm_code, cycle_time, count_shift
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            flatten_data['event'],
            flatten_data['source'],
            flatten_data['department'],
            flatten_data['machine'],
            flatten_data['machine_type'],
            flatten_data['timestamp'],
            flatten_data['part_name'],
            flatten_data['plan'],
            flatten_data['operator_id'],
            flatten_data['count_signal'],
            flatten_data['run'],
            flatten_data['idle'],
            flatten_data['alarm'],
            flatten_data['offline'],
            flatten_data['alarm_code'],
            flatten_data['cycle_time'],
            flatten_data['count_shift']
        )

        cursor.execute(query, values)

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False
 
def save_heat_data(_db_pool,data):
    # return True
    try:
        conn = _db_pool.connection()
        cursor = conn.cursor()
        flatten_data = flatten_heat_event(data)
        query = """
        INSERT INTO raw_heat (
            event, source, department, machine, machine_type, timestamp,
            part_name, plan, operator_id,
            run, heat, count_signal, idle, setting, alarm, offline, 
            alarm_code, cycle_time, count_shift 
        ) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            flatten_data['event'],
            flatten_data['source'],
            flatten_data['department'],
            flatten_data['machine'],
            flatten_data['machine_type'],
            flatten_data['timestamp'],
            flatten_data['part_name'],
            flatten_data['plan'],
            flatten_data['operator_id'],
            flatten_data['run'],
            flatten_data['heat'],
            flatten_data['count_signal'],
            flatten_data['idle'],
            flatten_data['setting'],
            flatten_data['alarm'],
            flatten_data['offline'],
            flatten_data['alarm_code'],
            flatten_data['cycle_time'],
            flatten_data['count_shift']
        )
        cursor.execute(query, values)            

        cursor.close()
        conn.close() # not needed; returned to pool automatically
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False
    
def save_lathe_data(_db_pool,data):
    # return True
    try:

        conn = _db_pool.connection()
        cursor = conn.cursor()
        flatten_data = flatten_lathe_event(data)
        query = """
        INSERT INTO raw_lathe (
            event, source, department, machine, machine_type, timestamp,
            part_name, plan, operator_id,
            count_signal, run, idle, alarm, offline,
            alarm_code, cycle_time, count_shift
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            flatten_data['event'],
            flatten_data['source'],
            flatten_data['department'],
            flatten_data['machine'],
            flatten_data['machine_type'],
            flatten_data['timestamp'],
            flatten_data['part_name'],
            flatten_data['plan'],
            flatten_data['operator_id'],
            flatten_data['count_signal'],
            flatten_data['run'],
            flatten_data['idle'],
            flatten_data['alarm'],
            flatten_data['offline'],
            flatten_data['alarm_code'],
            flatten_data['cycle_time'],
            flatten_data['count_shift']
        )

        cursor.execute(query, values)

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"❌ DB write error: {e}")
        return False
