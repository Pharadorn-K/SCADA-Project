# backend/python/utils/clean_data.py
import struct

def clean_data(raw_data):
    global status    
    status.clear()

    time_stamp_cleaned = raw_data["timestamp"]
    status.append(time_stamp_cleaned)

    part_name_head = raw_data["words"][5376:5387]
    # Pack all numbers as little-endian unsigned shorts (2 bytes each)
    byte_data = b''.join(struct.pack('<H', n) for n in part_name_head)
    # Decode as ASCII (or 'latin-1' to be safe with 0-255)
    result = byte_data.decode('ascii').rstrip(' \x00\t\r\n')
    status.append(result)

    cleaned_status = status.copy()
    print(cleaned_status)  # Output: 45351-KVB-S020-M2
    return cleaned_status  # Implementation of word data cleaning logic

def plc_received_to_string(received):
    try:
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

def heat_clean(data):
    print("Heat clean data start",data[1][0:3])
    return data[1][0:3]
def lathe_clean(data):
    print("Lathe clean data start",data[1][0:3])
    return data[1][0:3]
def eq_press_clean(data):
    print("Eq Press clean data start",data[1][0:3])
    return data[1][0:3]

# Read all row after last output
def row_after_output(_db_pool,time_stamp,department,machine_name,part_name):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT time_stamp,output_,idle_,alarm_,offline_
            FROM pc_press_2
            WHERE id_row >=(
                SELECT id_row
                FROM pc_press_2
                WHERE DATE(time_stamp) = DATE(%s) AND department_ = %s AND machine_name = %s AND part_name = %s AND output_ = %s
                ORDER BY time_stamp DESC
                LIMIT 1
                ) AND DATE(time_stamp) = DATE(%s) AND department_ = %s AND machine_name = %s AND part_name = %s
            ORDER BY time_stamp ASC
        """
    elif department == "Heat":
        query = """
            SELECT time_stamp,output_,idle_,setting_,alarm_,offline_
            FROM pc_heat_2
            WHERE id_row >=(
                SELECT id_row
                FROM pc_heat_2
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

# Count today production 
def count_production(_db_pool,time_stamp,department,machine_name):
    conn = _db_pool.connection()
    if department == "Press":
        query = """
            SELECT COUNT(output_) AS count_output
            FROM pc_press_2
            WHERE DATE(time_stamp) = DATE(%s) AND department_ = %s AND  machine_name = %s AND output_ = %s
        """
    elif department == "Heat":
        query = """
            SELECT COUNT(output_) AS count_output
            FROM pc_heat_2
            WHERE DATE(time_stamp) = DATE(%s) AND department_ = %s AND  machine_name = %s AND output_ = %s
        """
    cursor = conn.cursor()
    cursor.execute(query, (time_stamp,department,machine_name,1))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result['count_output'] if result and 'count_output' in result else 0

def press_clean(_db_pool,all_department,all_machine,all_data,data):
    point_int = [7,1,13,6,0]
    point_str = ["idle_","alarm_","offline_"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data in (all_data[point_int[4]]):
                if data["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data["type_"])
                    if data["note_"] == "Part_Name":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data["note_"] == "Plan" :
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]][0]
                        each_machine.append(pick_up)
                    elif data["note_"] == "Alarm_Code":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]][0]
                        each_machine.append(pick_up)
                    elif data["note_"] == "ID_Operator":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data["note_"] == "Status":
                        pick_up = bit_received[data["target_"]:data["target_"]+data["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)       
        # return machine_data
        if machine_data != []:
            for list_data in range(len(machine_data)):
                status_check,count_check,status_count_check = [],[],[]
                status_check = machine_data[list_data].copy()  
                status_check[point_int[0]] = 0
                if status_check[point_int[1]:point_int[2]] != compare_press_status[list_data]:
                    cycle_time = 0
                    count_today = 0
                    # queue_save_press.put((status_check,cycle_time,count_today))
                    compare_press_status[list_data] = status_check[point_int[1]:point_int[2]]
                    return status_check,cycle_time,count_today
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
                                cycle_time = (status_count_check[0] - old_row[0]["time_stamp"]).total_seconds()
                        count_today = count_production(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1  
                        # queue_save_press.put((status_count_check,cycle_time,count_today))                               
                        compare_press_count[list_data] = count_check
                        return status_count_check,cycle_time,count_today
                    else : 
                        pass
                else :
                    compare_press_count[list_data] = count_check
        # else:
        #     pass
    except Exception as e:
        print("❌ Press clean data error:",e)


def heat_clean(_db_pool,all_department,all_machine,all_data,data):
    point_int = [9,1,15,95,1]
    point_str = ["alarm_","setting_"]
    try :                    
        machine_data = [] 
        current_time,bit_received,word_received = data
        for machine in all_machine[point_int[4]]:
            each_machine = []
            each_machine.append(current_time)
            each_machine.append(all_department[point_int[4]])
            each_machine.append(machine)
            for data in (all_data[point_int[4]]):
                if data["machine_"] == machine:
                    if len(each_machine) <=3:
                        each_machine.append(data["type_"])
                    if data["note_"] == "Part_Name":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data["note_"] == "Plan" :
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]][0]
                        each_machine.append(pick_up)
                    elif data["note_"] == "Alarm_Code":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]][0]
                        each_machine.append(pick_up)
                    elif data["note_"] == "ID_Operator":
                        pick_up = word_received[data["target_"]:data["target_"]+data["range_"]]
                        string_pick = plc_received_to_string(pick_up)
                        each_machine.append(string_pick)
                    elif data["note_"] == "Status":
                        pick_up = bit_received[data["target_"]:data["target_"]+data["range_"]]
                        int_pick = int(pick_up[0])
                        each_machine.append(int_pick)
            machine_data.append(each_machine)
        return machine_data
        # if machine_data != []:
        #     for list_data in range(len(machine_data)):
        #         status_check,count_check,status_count_check = [],[],[]
        #         status_check = machine_data[list_data].copy()  
        #         status_check[point_int[0]] = 0
        #         if status_check[point_int[1]:point_int[2]] != compare_status[list_data]:
        #             cycle_time = 0
        #             count_today = 0
        #             # queue_save_heat.put((status_check,cycle_time,count_today))   
        #             compare_status[list_data] = status_check[point_int[1]:point_int[2]]
        #             return status_check,cycle_time,count_today
        #         else : 
        #             pass
                
        #         status_count_check = machine_data[list_data].copy()
        #         count_check = status_count_check[point_int[0]]
        #         if count_check != 0:
        #             if count_check != compare_count[list_data]:
        #                 old_row = row_after_output(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2],status_count_check[4])
        #                 cycle_time = 0
        #                 if old_row == () or old_row == None:
        #                     cycle_time = point_int[3]
        #                 else:
        #                     for row in old_row:
        #                         if row[point_str[0]] == 1 or row[point_str[1]] == 1:
        #                             cycle_time = point_int[3]
        #                             break
        #                     if cycle_time != point_int[3]:
        #                         cycle_time = (status_count_check[0] - old_row[0]["time_stamp"]).total_seconds()
        #                 count_today = count_production(_db_pool,status_count_check[0],all_department[point_int[4]],status_count_check[2]) + 1  
        #                 # queue_save_heat.put((status_count_check,cycle_time,count_today))                                  
        #                 compare_count[list_data] = count_check
        #                 return status_count_check,cycle_time,count_today
        #             else : 
        #                 pass
        #         else :
        #             compare_count[list_data] = count_check
        # else:
            # pass
    except Exception as e:
        print("❌ Heat clean data error:",e)
