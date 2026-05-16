from fastapi import APIRouter, Query, HTTPException
import os
import psycopg
from psycopg.rows import dict_row
from pydantic import BaseModel

from app.services.vehicles import get_latest_by_route_and_direction, get_latest_by_fleet_id
from app.models.vehicles import VehicleLatest

router = APIRouter(tags=["Vehicles"])
DATABASE_URL = os.environ["DATABASE_URL"]

@router.get("/latest", response_model=list[VehicleLatest])
def latest(
    route: str | None = Query(default=None, description="Route id, e.g. 704"),
    direction: int | None = Query(default=None, description="Direction id, 0 or 1"),
):
    return get_latest_by_route_and_direction(route, direction)

@router.get("/vehicle/{vehicle_id}", response_model=VehicleLatest)
def vehicle_latest(vehicle_id: str):
    row = get_latest_by_fleet_id(vehicle_id)
    if not row:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return row

@router.get("/vehicle")
async def get_all_vehicles():
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT
                        vehicle_id,
                        vehicle_license_plate,
                        vehicle_type,
                        vehicle_fuel,
                        vehicle_model,
                        vehicle_chassis_year
                    FROM bus.fleet
                    """, )
                
                rows = cur.fetchall()
                
                return rows
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))