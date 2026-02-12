# backend/python/utils/clean_data.py
import struct

# def clean_data(raw_data):
#     global status    
#     status.clear()

#     time_stamp_cleaned = raw_data["timestamp"]
#     status.append(time_stamp_cleaned)

#     part_name_head = raw_data["words"][5376:5387]
#     # Pack all numbers as little-endian unsigned shorts (2 bytes each)
#     byte_data = b''.join(struct.pack('<H', n) for n in part_name_head)
#     # Decode as ASCII (or 'latin-1' to be safe with 0-255)
#     result = byte_data.decode('ascii').rstrip(' \x00\t\r\n')
#     status.append(result)

#     cleaned_status = status.copy()
#     print(cleaned_status)  # Output: 45351-KVB-S020-M2
#     return cleaned_status  # Implementation of word data cleaning logic

def plc_received_to_string(received):
    try:
        for i in received:
            if i == -1:
                received.remove(i)
        byte_data = b''.join(struct.pack('<H', n) for n in received)
        # Decode as ASCII (or 'latin-1' to be safe with 0-255)
        result = byte_data.decode('ascii').rstrip(' \x00\t\r\n')
    except Exception as e:
        print("❌ PLC received to string error:",e)
    return result


def get_all_location(_db_pool,keys):
    conn = _db_pool.connection()
    cursor = conn.cursor()
    if keys == "PLC":
        query = """
            SELECT target_,range_
            FROM source_plc_location
            WHERE type_ = %s 
            ORDER BY id_row ASC
            """
    elif keys == "Read_location":
        query = """
            SELECT type_,target_,range_
            FROM source_plc_location
            WHERE note_ = %s
            ORDER BY id_row ASC
            """
    elif keys == "All":
        query = """
            SELECT type_,department_,machine_,target_,range_,note_
            FROM source_plc_location
            WHERE department_ <> %s AND note_ <> "Equipment"
            ORDER BY id_row ASC
            """
    elif keys == "Equipment":
        query = """ 
            SELECT category_,type_,department_,machine_,target_,range_,note_
            FROM source_plc_location
            WHERE note_ = %s
            ORDER BY id_row ASC           
            """
    cursor.execute(query,(keys,))
    location = cursor.fetchall()
    cursor.close()
    conn.close()
    return location
def get_range(all_range):
    all_department = list(dict.fromkeys(i["department_"] for i in all_range))
    if all_range[0]["note_"] == "Equipment":
        all_category = list(dict.fromkeys(i["category_"] for i in all_range)) 
    else:
        all_category = []
    all_data,all_machine = [],[]
    for department in all_department:
        group_data = []
        for range_ in range(len(all_range)):    
            if  department == all_range[range_]["department_"]:
                hex = (all_range[range_]["target_"][1:])
                dec = int(hex,16)
                all_range[range_]["target_"] = dec
                group_data.append(all_range[range_])
        list_machine = list(dict.fromkeys(i["machine_"] for i in group_data))
        all_machine.append(list_machine)
        all_data.append(group_data)
    return all_department,all_machine,all_data,all_category
def get_range_equipment(all_range_equipment):
    all_department = list(dict.fromkeys(i["department_"] for i in all_range_equipment))

    all_machine = []
    for department in range(len(all_department)):
        each_machine = []
        for data in range(len(all_range_equipment)):
            if all_range_equipment[data]["department_"] == all_department[department]:
                each_machine.append(all_range_equipment[data]["machine_"])
        filter_machine = list(dict.fromkeys(machine for machine in each_machine))
        all_machine.append(filter_machine)

    all_category = []
    all_data = []
    for department in range(len(all_department)):
        each_machine = []
        each_machine_data = []
        for machine in range(len(all_machine[department])):
            each_category = []
            each_category_data = []
            for data in range(len(all_range_equipment)):  
                if all_range_equipment[data]["department_"] == all_department[department] and all_range_equipment[data]["machine_"] == all_machine[department][machine]:
                    each_category.append(all_range_equipment[data]["category_"])
                    hex = (all_range_equipment[data]["target_"][1:])
                    dec = int(hex,16)
                    all_range_equipment[data]["target_"] = dec
                    each_category_data.append(all_range_equipment[data])
            each_machine.append(each_category)
            each_machine_data.append(each_category_data)
        all_category.append(each_machine)
        all_data.append(each_machine_data)

    return all_department,all_machine,all_category,all_data


# Filter process Press
compare_press_count,compare_press_status = [[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[]]
compare_heat_count,compare_heat_status = [[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[]]
compare_lathe_count,compare_lathe_status = [[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[]]
# Read all row after last output
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
        """  
    cursor = conn.cursor()
    cursor.execute(query,(timestamp,department,machine_name,part_name,1,timestamp,department,machine_name,part_name))
    row = cursor.fetchall()  
    cursor.close()
    conn.close()
    return row

# Count today production 
def count_production(_db_pool,timestamp,department,machine):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_press
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND count_signal = %s
        """
    elif department == "Heat":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_heat
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND count_signal = %s
        """
    elif department == "Lathe":
        query = """
            SELECT COUNT(count_signal) AS count_output
            FROM raw_lathe
            WHERE DATE(timestamp) = DATE(%s) AND department = %s AND  machine = %s AND count_signal = %s
        """
    cursor = conn.cursor()
    cursor.execute(query, (timestamp,department,machine,1))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result['count_output'] if result and 'count_output' in result else 0

def press_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q):
    point_int = [7,1,13,6,0]
    point_str = ["idle","alarm","offline"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data_range in (all_data[point_int[4]]):
                if data_range["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data_range["type_"])
                    if data_range["note_"] == "Part_Name":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Plan" :
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "Alarm_Code":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "ID_Operator":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Status":
                        pick_up = bit_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)    
        if machine_data != []:
            for list_data in range(len(machine_data)):
                status_check = machine_data[list_data].copy()  
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_press_status[list_data]:
                    cycle_time = 0
                    count_today = 0
                    compare_press_status[list_data] = status_check[point_int[1]:point_int[2]]
                    clean_db_q.put({
                        "event": "plc_clean",
                        "source": "clean_press",
                        "department": "Press",
                        "machine": status_check[2],
                        "machine_type": status_check[3],
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "count_signal": status_check[7],
                            "run": status_check[8],
                            "idle": status_check[9],
                            "alarm": status_check[10],
                            "offline": status_check[11],
                            "alarm_code": status_check[12],
                            "cycle_time": cycle_time,
                            "count_today": count_today
                        }
                    })
                    broadcast_q.put({
                        "event": "plc_clean",
                        "source": "clean_press",
                        "department": "Press",
                        "machine": status_check[2],
                        "machine_type": status_check[3],
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "count_signal": status_check[7],
                            "run": status_check[8],
                            "idle": status_check[9],
                            "alarm": status_check[10],
                            "offline": status_check[11],
                            "alarm_code": status_check[12],
                            # "cycle_time": cycle_time,
                            # "count_today": count_today
                        }
                    })
                else : 
                    pass
                
                status_count_check = machine_data[list_data].copy()
                count_check = status_count_check[point_int[0]]
                if count_check != 0:
                    if count_check != compare_press_count[list_data]:
                        old_row = row_after_output(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2],status_count_check[4])
                        cycle_time = 0
                        if old_row == () or old_row == None:
                            cycle_time = point_int[3]
                        else:
                            for row in old_row:
                                if row[point_str[0]] == 1 or row[point_str[1]] == 1 or row[point_str[2]] == 1:
                                    cycle_time = point_int[3]
                                    break
                            if cycle_time != point_int[3]:
                                cycle_time = (status_count_check[0] - old_row[0]["timestamp"]).total_seconds()
                        count_today = count_production(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1                            
                        compare_press_count[list_data] = count_check
                        clean_db_q.put({
                            "event": "plc_clean",
                            "source": "clean_press",
                            "department": "Press",
                            "machine": status_check[2],
                            "machine_type": status_check[3],
                            "timestamp": status_check[0],

                            "context": {
                                "part_name": status_check[4],
                                "plan": status_check[5],
                                "operator_id": status_check[6],
                            },

                            "metrics": {
                                "count_signal": status_check[7],
                                "run": status_check[8],
                                "idle": status_check[9],
                                "alarm": status_check[10],
                                "offline": status_check[11],
                                "alarm_code": status_check[12],
                                "cycle_time": cycle_time,
                                "count_today": count_today
                            }
                        })
                        broadcast_q.put({
                            "event": "plc_clean",
                            "source": "clean_press",
                            "department": "Press",
                            "machine": status_check[2],
                            "machine_type": status_check[3],
                            "timestamp": status_check[0],

                            "context": {
                                "part_name": status_check[4],
                                "plan": status_check[5],
                                "operator_id": status_check[6],
                            },

                            "metrics": {
                                "count_signal": status_check[7],
                                "run": status_check[8],
                                "idle": status_check[9],
                                "alarm": status_check[10],
                                "offline": status_check[11],
                                "alarm_code": status_check[12],
                                "cycle_time": cycle_time,
                                "count_today": count_today
                            }
                        })
                    else : 
                        pass
                else :
                    compare_press_count[list_data] = count_check        
        else:
            pass
    except Exception as e:
        print("❌ Press clean data error:",e)
  
def heat_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q):
    point_int = [9,1,15,95,1]
    point_str = ["alarm","setting"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data_range in (all_data[point_int[4]]):
                if data_range["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data_range["type_"])
                    if data_range["note_"] == "Part_Name":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Plan" :
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "Alarm_Code":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "ID_Operator":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Status":
                        pick_up = bit_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)

        if machine_data != []:
            for list_data in range(len(machine_data)):
                status_check = machine_data[list_data].copy()  
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_heat_status[list_data]:
                    cycle_time = 0
                    count_today = 0
                    compare_heat_status[list_data] = status_check[point_int[1]:point_int[2]]
                    clean_db_q.put({
                        "event": "plc_clean",
                        "source": "clean_heat",
                        "department": "Heat",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "run": status_check[7],
                            "heat": status_check[8],
                            "count_signal": status_check[9],
                            "idle": status_check[10],
                            "setting": status_check[11],
                            "alarm": status_check[12],
                            "offline": status_check[13],
                            "alarm_code": status_check[14],
                            "cycle_time": cycle_time,
                            "count_today": count_today
                        }
                    })
                    broadcast_q.put({
                        "event": "plc_clean",
                        "source": "clean_heat",
                        "department": "Heat",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": status_check[5],
                            "operator_id": status_check[6],
                        },

                        "metrics": {
                            "run": status_check[7],
                            "heat": status_check[8],
                            "count_signal": status_check[9],
                            "idle": status_check[10],
                            "setting": status_check[11],
                            "alarm": status_check[12],
                            "offline": status_check[13],
                            "alarm_code": status_check[14],
                            # "cycle_time": cycle_time,
                            # "count_today": count_today
                        }
                    })
                else : 
                    pass
                
                status_count_check = machine_data[list_data].copy()
                count_check = status_count_check[point_int[0]]
                if count_check != 0:
                    if count_check != compare_heat_count[list_data]:
                        old_row = row_after_output(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2],status_count_check[4])
                        cycle_time = 0
                        if old_row == () or old_row == None:
                            cycle_time = point_int[3]
                        else:
                            for row in old_row:
                                if row[point_str[0]] == 1 or row[point_str[1]] == 1:
                                    cycle_time = point_int[3]
                                    break
                            if cycle_time != point_int[3]:
                                cycle_time = (status_count_check[0] - old_row[0]["timestamp"]).total_seconds()
                        count_today = count_production(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1       
                        compare_heat_count[list_data] = count_check
                        clean_db_q.put({
                            "event": "plc_clean",
                            "source": "clean_heat",
                            "department": "Heat",
                            "machine": status_check[2],
                            "machine_type": status_check[3],   # Machine / Robot
                            "timestamp": status_check[0],

                            "context": {
                                "part_name": status_check[4],
                                "plan": status_check[5],
                                "operator_id": status_check[6],
                            },

                            "metrics": {
                                "run": status_check[7],
                                "heat": status_check[8],
                                "count_signal": status_check[9],
                                "idle": status_check[10],
                                "setting": status_check[11],
                                "alarm": status_check[12],
                                "offline": status_check[13],
                                "alarm_code": status_check[14],
                                "cycle_time": cycle_time,
                                "count_today": count_today
                            }
                        })                             
                        broadcast_q.put({
                            "event": "plc_clean",
                            "source": "clean_heat",
                            "department": "Heat",
                            "machine": status_check[2],
                            "machine_type": status_check[3],   # Machine / Robot
                            "timestamp": status_check[0],

                            "context": {
                                "part_name": status_check[4],
                                "plan": status_check[5],
                                "operator_id": status_check[6],
                            },

                            "metrics": {
                                "run": status_check[7],
                                "heat": status_check[8],
                                "count_signal": status_check[9],
                                "idle": status_check[10],
                                "setting": status_check[11],
                                "alarm": status_check[12],
                                "offline": status_check[13],
                                "alarm_code": status_check[14],
                                "cycle_time": cycle_time,
                                "count_today": count_today
                            }
                        })
                    else : 
                        pass
                else :
                    compare_heat_count[list_data] = count_check
        else:
            pass
    except Exception as e:
        print("❌ Heat clean data error:",e)

def lathe_clean(_db_pool,all_department,all_machine,all_data,data,clean_db_q,broadcast_q):
    point_int = [8,1,9,90,2]
    point_str = ["alarm","offline"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data_range in (all_data[point_int[4]]):
                if data_range["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data_range["type_"])
                    if data_range["note_"] == "Part_Name":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Plan" :
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "Alarm_Code":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]][0]
                        each_machine.append(pick_up)
                    elif data_range["note_"] == "ID_Operator":
                        pick_up = word_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data_range["note_"] == "Status":
                        pick_up = bit_received[data_range["target_"]:data_range["target_"]+data_range["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)
        if machine_data != []:
            for list_data in range(len(machine_data)):
                status_check = machine_data[list_data].copy()
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_lathe_status[list_data]:
                    cycle_time = 0
                    count_today = 0
                    compare_lathe_status[list_data] = status_check[point_int[1]:point_int[2]]
                    clean_db_q.put({
                        "event": "plc_clean",
                        "source": "clean_lathe",
                        "department": "Lathe",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": 0, #wait from PLC
                            "operator_id": 0, #wait from PLC
                        },

                        "metrics": {
                            "run": status_check[6],
                            "idle": status_check[5],                            
                            "alarm": status_check[7],
                            "count_signal": status_check[8],
                            "offline": 0, #wait from PLC
                            "alarm_code": 0, #wait from PLC
                            "cycle_time": cycle_time,
                            "count_today": count_today
                        }
                    })
                    broadcast_q.put({
                        "event": "plc_clean",
                        "source": "clean_lathe",
                        "department": "Lathe",
                        "machine": status_check[2],
                        "machine_type": status_check[3],   # Machine / Robot
                        "timestamp": status_check[0],

                        "context": {
                            "part_name": status_check[4],
                            "plan": 0, #wait from PLC
                            "operator_id": 0, #wait from PLC
                        },

                        "metrics": {
                            "run": status_check[6],
                            "idle": status_check[5],                            
                            "alarm": status_check[7],
                            "count_signal": status_check[8],
                            "offline": 0, #wait from PLC
                            "alarm_code": 0, #wait from PLC
                            # "cycle_time": cycle_time,
                            # "count_today": count_today
                        }
                    })
                else : 
                    pass
                
                status_count_check = machine_data[list_data].copy()
                count_check = status_count_check[point_int[0]]
                if count_check != 0:
                    if count_check != compare_lathe_count[list_data]:
                        old_row = row_after_output(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2],status_count_check[4])
                        cycle_time = 0
                        if old_row == () or old_row == None:
                            cycle_time = point_int[3]
                        else:
                            for row in old_row:
                                if row[point_str[0]] == 1 or row[point_str[1]] == 1 :
                                    cycle_time = point_int[3]
                                    break
                            if cycle_time != point_int[3]:
                                cycle_time = (status_count_check[0] - old_row[0]["timestamp"]).total_seconds()
                        count_today = count_production(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1                            
                        compare_lathe_count[list_data] = count_check
                        clean_db_q.put({
                            "event": "plc_clean",
                            "source": "clean_lathe",
                            "department": "Lathe",
                            "machine": status_check[2],
                            "machine_type": status_check[3],   # Machine / Robot
                            "timestamp": status_check[0],

                            "context": {
                                "part_name": status_check[4],
                                "plan": 0, #wait from PLC
                                "operator_id": 0, #wait from PLC
                            },

                            "metrics": {
                                "run": status_check[6],
                                "idle": status_check[5],                            
                                "alarm": status_check[7],
                                "count_signal": status_check[8],
                                "offline": 0, #wait from PLC
                                "alarm_code": 0, #wait from PLC
                                "cycle_time": cycle_time,
                                "count_today": count_today
                            }
                        })
                        broadcast_q.put({
                            "event": "plc_clean",
                            "source": "clean_lathe",
                            "department": "Lathe",
                            "machine": status_check[2],
                            "machine_type": status_check[3],   # Machine / Robot
                            "timestamp": status_check[0],

                            "context": {
                                "part_name": status_check[4],
                                "plan": 0, #wait from PLC
                                "operator_id": 0, #wait from PLC
                            },

                            "metrics": {
                                "run": status_check[6],
                                "idle": status_check[5],                            
                                "alarm": status_check[7],
                                "count_signal": status_check[8],
                                "offline": 0, #wait from PLC
                                "alarm_code": 0, #wait from PLC
                                "cycle_time": cycle_time,
                                "count_today": count_today
                            }
                        })
                    else : 
                        pass
                else :
                    compare_lathe_count[list_data] = count_check       
    except Exception as e:
        print("❌ Lathe clean data error:",e)


if __name__ == "__main__":
    data_a = [12338, 12850, 13364, 8243, 8224, -1]
    data_b = [14414, 11577, 13105, 8248, 8224, -1]
    print(plc_received_to_string(data_a))
    print(plc_received_to_string(data_b))