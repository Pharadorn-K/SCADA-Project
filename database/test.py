# import pymcprotocol
# import time
# from datetime import datetime


# mc = None
# def connect_to_plc(plc_location):
#     global mc
#     try:
#         mc = pymcprotocol.Type3E()
#         mc.connect(plc_location[0], plc_location[1])
#         print(f"Connection to PLC {plc_location[0]}, {plc_location[1]} successful.")
#         return True
#     except Exception as e1:
#         print(f"Connection to PLC IP : {plc_location[0]}, Port : {plc_location[1]} failed: {e1}")
#         return False
  
# def call_time():
#     time_now = datetime.now()
#     return time_now

# def read_plc(plc_location,location):
#     i = 0
#     while i<8:
#         i += 1
#         connect_to_plc(plc_location)
#         if mc is not None:
#             try:
#                 act_time = call_time()
#                 bit_received,word_received = [],[]

#                 value = mc.batchread_bitunits(headdevice=location[0], readsize=location[1])
#                 bit_received.extend(value)

#                 value = mc.batchread_wordunits(headdevice=location[2], readsize=location[3])
#                 word_received.extend(value)
#                 print(f"Time: {act_time}, Bit Data: {bit_received}, Word Data: {word_received}")
#             except Exception as e5:
#                 print(f"Error reading from PLC: {e5}")
#                 bit_received, word_received = [], []
#         else:
#             break          
#         time.sleep(1)

# plc_location = ["10.207.1.24", 5010]         
# location = ["B90",10 , "W0", 1]

# read_plc(plc_location,location)
import pymcprotocol
from datetime import datetime

mc = None

def connect_to_plc(ip, port):
    global mc
    try:
        mc = pymcprotocol.Type3E()
        mc.connect(ip, port)
        print(f"✅ Connected to {ip}:{port}")
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def read_test():
    ip, port = "10.207.1.24", 5010
    if connect_to_plc(ip, port):
        try:
            # Read 10 bits starting at B90 → headdevice=90 (bit address)
            bits = mc.batchread_bitunits(headdevice="B90", readsize=10)
            words = mc.batchread_wordunits(headdevice="W50", readsize=12)
            words_string = plc_received_to_string(words)
            print(f"🕒 {datetime.now()} | B90-B99: {bits} | W0: {words}")
            print(f"🕒 {datetime.now()} | B90-B99: {bits} | W0: {words_string}")
        except Exception as e:
            print("Read error:", e)
        finally:
            mc.close()
def plc_received_to_string(received):
    read,gether = [],[]
    for value in received:
        if value != 0:
            hex_str = f"{value:04X}"  
            swapped = hex_str[2:] + hex_str[:2]  # Swap bytes
            read.append(bytes.fromhex(swapped).decode("ascii"))  # Convert to ASCII
    if read == []:
        gether = "Support Other Coil"
    else:
        gether = "".join(read)
    return gether
# if __name__ == "__main__":
#     read_test()
b = (1,2)
c = 3
d = 4
a = (b,c,d)

x,y,z = a
print(y)