from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # backend/
DATA_DIR = os.path.join(BASE_DIR, "..", "data")        # ../data
DEMAND_FILE_PATH = os.path.join(DATA_DIR, "demand_inventory.csv")

DEMAND_DB_URL = f"file://{DEMAND_FILE_PATH}"

engine_d = create_engine(DEMAND_DB_URL, connect_args={"check_same_thread":False})
SessionDemand = sessionmaker(autocommit=False, autoflush=False, bind=engine_d)

Base = declarative_base()