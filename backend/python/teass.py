# import os
# from dotenv import load_dotenv
# import psycopg2
# from psycopg2.extras import Json
# try :
#     load_dotenv(dotenv_path="backend/node/.env")
#     print("✅ Loaded environment variables:")
#     print(f"  DB_URL: {os.getenv('DB_URL')}")
#     print(f"  PLC_IP: {os.getenv('PLC_IP')}")
#     print(f"  PLC_PORT: {os.getenv('PLC_PORT')}")
#     print(f"  TCP_HOST: {os.getenv('TCP_HOST')}")
#     print(f"  TCP_PORT: {os.getenv('TCP_PORT')}")
# except Exception as e:
#     print(f"❌ Error loading .env file: {e}")
# load_dotenv(dotenv_path="backend/node/.env")
# print(f"  DB_URL: {os.getenv('DB_URL')}")
# print(f"  PLC_IP: {os.getenv('PLC_IP')}")
# print(f"  PLC_PORT: {os.getenv('PLC_PORT')}")
# print(f"  TCP_HOST: {os.getenv('TCP_HOST')}")
# print(f"  TCP_PORT: {type(int(os.getenv('TCP_PORT')))}")
# DB_URL = os.getenv("DB_URL")

# load_dotenv(dotenv_path="backend/node/.env")

# DB_URL = os.getenv("DATABASE_URL")
# _connection = None

# def get_connection():
#     global _connection
#     if _connection is None or _connection.closed != 0:
#         _connection = psycopg2.connect(DB_URL)
#     return _connection

# conn = get_connection()
# print("Connected:", conn)

# .env
# DB_HOST=10.207.1.87
# DB_PORT=5432
# DB_USER=PCSET007
# DB_PASSWORD=123456
# DB_NAME=scada

# db.py
# from psycopg2 import pool
# import os
# from dotenv import load_dotenv
# import psycopg2
# import pymysql
# from dbutils.pooled_db import PooledDB
# load_dotenv(dotenv_path="backend/node/.env")

# conn_pool = psycopg2.pool.SimpleConnectionPool(
#     minconn=1,
#     maxconn=10,
#     host=os.getenv("DB_HOST"),
#     port=os.getenv("DB_PORT"),
#     user=os.getenv("DB_USER"),
#     password=os.getenv("DB_PASSWORD"),
#     database=os.getenv("DB_NAME")
# )

# def get_connection():
#     return conn_pool.getconn()

# def release_connection(conn):
#     conn_pool.putconn(conn)
# def create_pool():
#     try:
#         load_dotenv(dotenv_path="backend/node/.env")
#         pool = PooledDB(
#             creator=pymysql,
#             host=os.getenv("DB_HOST"),
#             port=int(os.getenv("DB_PORT")),
#             user=os.getenv("DB_USER"),
#             password=os.getenv("DB_PASSWORD"),
#             database=os.getenv("DB_NAME"),
#             mincached=int(os.getenv("DB_MIN")),
#             maxcached=int(os.getenv("DB_MAX")),
#             cursorclass=pymysql.cursors.DictCursor
#         )
#         print("pool created")          
#     except Exception as e:
#         print(f"❌ Error creating DB pool: {e}")
#         return None
      
#     return pool
# db_pool = create_pool()
# from dbutils.pooled_db import PooledDB
# import pymysql
# from dotenv import load_dotenv
# import os
# from pathlib import Path
# # --- Load config ---
# env_path = Path(__file__).parent.parent.parent / "backend" / "node" / ".env"
# load_dotenv(dotenv_path=env_path)
# print(f"  DB_HOST: {os.getenv('DB_HOST')}")
# print(f"  DB_PORT: {os.getenv('DB_PORT')}")
# print(f"  DB_USER: {os.getenv('DB_USER')}")
# print(f"  DB_PASSWORD: {os.getenv('DB_PASSWORD')}")
# print(f"  DB_MIN: {os.getenv('DB_MIN')}")
# print(f"  DB_MAX: {os.getenv('DB_MAX')}")
# # --- Create connection pool ---
# def create_pool():
#     try:
#         pool = PooledDB(
#             creator=pymysql,
#             host=os.getenv("DB_HOST"),
#             port=int(os.getenv("DB_PORT")),
#             user=os.getenv("DB_USER"),
#             password=os.getenv("DB_PASSWORD"),
#             database=os.getenv("DB_NAME"),
#             mincached=int(os.getenv("DB_MIN", 1)),
#             maxcached=int(os.getenv("DB_MAX", 3)),
#             charset='utf8mb4',
#             cursorclass=pymysql.cursors.DictCursor,
#             autocommit=True  # Important: auto-commit INSERTs
#         )
#         print("✅ MySQL connection pool created")
#         return pool
#     except Exception as e:
#         print(f"❌ Failed to create DB pool: {e}")
#         return None

# db_pool = create_pool()

first, my code look like this:
# backend/python/a.py
try:
    # Prefer relative import when running as a package
    from .utils import b
except Exception:
    # Fall back to direct import when running as a script
    from utils import b

def other_use_pool_function(data):
    global db_pool
    if db_pool is None:
        print("⚠️ DB pool not available. Skipping save.")
        return False
    

# backend/python/utils/b.py
from dbutils.pooled_db import PooledDB
import pymysql
from dotenv import load_dotenv
from pathlib import Path
import os
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

db_pool = create_pool()

def use_pool_function(data):
    global db_pool
    if db_pool is None:
        print("⚠️ DB pool not available. Skipping save.")
        return False
    
So, the problem is that in plc_loop.py, the other_use_pool_function function is trying to use a global db_pool variable that is not defined within its scope. 
To fix this, we need to ensure that the db_pool is properly created and accessible within plc_loop.py. how to fix it?