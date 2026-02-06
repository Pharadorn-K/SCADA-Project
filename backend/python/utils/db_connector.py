from pathlib import Path
import os
from dbutils.pooled_db import PooledDB
import pymysql
from dotenv import load_dotenv

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
    
if __name__ == "__main__":
    try:
        db_pool = create_pool()
        print(db_pool)
    except Exception as e:
        print(f"{e}")