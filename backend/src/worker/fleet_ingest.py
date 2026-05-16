import os
import csv
import psycopg
from datetime import datetime

DATABASE_URL = os.environ["DATABASE_URL"]
FLEET_PATH = os.path.join(os.getcwd(), "fleet")

def ingest_fleet_data():
    path = os.path.join(FLEET_PATH, "fleet.txt")
    print("Ingesting fleet data...")
    sql = """
        INSERT INTO bus.fleet (vehicle_id, vehicle_license_plate, vehicle_type, vehicle_fuel, vehicle_model, vehicle_chassis_year)
        VALUES (%(vehicle_id)s, %(vehicle_license_plate)s, %(vehicle_type)s, %(vehicle_fuel)s, %(vehicle_model)s, %(vehicle_chassis_year)s)
        ON CONFLICT (vehicle_id) DO UPDATE SET
            vehicle_license_plate = EXCLUDED.vehicle_license_plate,
            vehicle_type = EXCLUDED.vehicle_type,
            vehicle_fuel = EXCLUDED.vehicle_fuel,
            vehicle_model = EXCLUDED.vehicle_model,
            vehicle_chassis_year = EXCLUDED.vehicle_chassis_year;
    """
    if not os.path.exists(path):
        print(f"Fleet data path {path} does not exist. Skipping fleet ingestion.")
        return
    
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            print(f"Processing {path}...")
            with open(path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    params = {k: (v if v != '' else None) for k, v in row.items()}
                    cur.execute(sql, params)
            conn.commit()


def is_fleet_data_loaded(cur):
    """Check if the schema exists and has data."""

    cur.execute("""
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'bus' 
            AND table_name = 'fleet'
        );
    """)
    if not cur.fetchone()[0]:
        return False

    # 2. If it exists, check if it actually has data
    cur.execute("SELECT EXISTS (SELECT 1 FROM bus.fleet LIMIT 1);")
    return cur.fetchone()[0]


def delete_fleet_data_tables():
    # If a new Fleet file was downloaded and processed, 
    # we need to empty the existing Fleet tables before re-ingesting the new data.
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("DROP SCHEMA IF EXISTS bus.fleet CASCADE;")
            cur.execute("CREATE SCHEMA bus.fleet;")
            print("Fleet tables cleared (schema dropped and recreated).")


def main():
 
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            print(f"--- Starting Fleet Data Ingestion at {datetime.now()} ---")
            ingest_fleet_data()

            print("--- Done ---")


if __name__ == "__main__":
    main()