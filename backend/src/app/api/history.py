from fastapi import APIRouter, HTTPException, Query
import psycopg
import os
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()
DATABASE_URL = os.environ["DATABASE_URL"]

class VehicleHistory(BaseModel):
    vehicle_id: str
    observed_at: datetime
    route_id: str
    direction: int
    trip_id: Optional[str]
    trip_headsign: Optional[str]
    lat: float
    lon: float
    heading: int
    last_stop_id: Optional[str]
    last_stop_name: Optional[str]
    cur_stop_id: Optional[str]
    route_short_name: Optional[str]
    route_long_name: Optional[str]

@router.get("/history", response_model=List[VehicleHistory])
async def get_vehicle_history(
    mode: str = Query(..., pattern="^(trip|route)$"),
    route_id: str = Query(...),
    date: str = Query(...), # Format: YYYY-MM-DD
    trip_id: Optional[str] = Query(None),
    start_time: Optional[str] = Query("00:00"),
    end_time: Optional[str] = Query("23:59")
):
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # # Base Query
                # base_sql = """
                #     SELECT 
                #         vehicle_id, observed_at, route_id, direction, trip_id,
                #         ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lon,
                #         last_stop_id, last_stop_name, cur_stop_id
                #     FROM bus.vehicle_observation
                #     WHERE route_id = %s AND observed_at::date = %s
                # """
                # Base Query
                base_sql = """
                    SELECT 
                        o.vehicle_id, o.observed_at, o.route_id, o.direction, o.trip_id, t.trip_headsign,
                        ST_Y(o.geom::geometry) as lat, ST_X(o.geom::geometry) as lon, o.heading,
                        o.last_stop_id, s.stop_name, o.cur_stop_id, r.route_short_name, r.route_long_name
                    FROM bus.vehicle_observation o
                    LEFT JOIN gtfs.routes r ON o.route_id = r.route_id
                    LEFT JOIN gtfs.stops s ON o.last_stop_id = s.stop_id
                    LEFT JOIN gtfs.trips t ON o.trip_id = t.trip_id
                    WHERE o.route_id = %s AND o.observed_at::date = %s
                """
                
                params = [route_id, date]

                if mode == "trip" and trip_id:
                    base_sql += " AND o.trip_id = %s"
                    params.append(trip_id)
                else:
                    base_sql += " AND o.observed_at::time >= %s AND o.observed_at::time <= %s"
                    params.extend([start_time or "00:00", end_time or "23:59"])

                base_sql += " ORDER BY o.observed_at ASC LIMIT 2000"

                cur.execute(base_sql, params)
                rows = cur.fetchall()

                return [
                    VehicleHistory(
                        vehicle_id=row[0],
                        observed_at=row[1],
                        route_id=row[2],
                        direction=row[3],
                        trip_id=row[4],
                        trip_headsign=row[5],
                        lat=row[6],
                        lon=row[7],
                        heading=row[8],
                        last_stop_id=row[9],
                        last_stop_name=row[10],
                        cur_stop_id=row[11],
                        route_short_name=row[12],
                        route_long_name=row[13]
                    ) for row in rows
                ]

    except Exception as e:
        print(f"History Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/trips-list")
async def get_trips_with_data(
    route_id: str = Query(...),
    date: str = Query(...)
):
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # Get unique trips for this route/day that have observations
                cur.execute("""
                    SELECT DISTINCT trip_id 
                    FROM bus.vehicle_observation 
                    WHERE route_id = %s 
                        AND CAST(observed_at AT TIME ZONE 'UTC' AS DATE) = %s
                        AND trip_id IS NOT NULL
                    ORDER BY trip_id ASC
                """, (route_id, date))
                
                rows = cur.fetchall()
                return [row[0] for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class TripExecution(BaseModel):
    trip_id: str
    vehicle_id: Optional[str] = None
    real_stop_id: Optional[str] = None
    real_arrival_time: Optional[datetime] = None
    estimated_arrival_time: Optional[datetime] = None
    planned_stop_id: str
    planned_stop_name: str
    planned_arrival_time: str


@router.get("/history/trip-execution", response_model=List[TripExecution])
async def get_trip_execution(
    trip_id: str = Query(...),
    date: str = Query(...)
):
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    WITH trip_identity AS (
                        -- Get vehicle and the shape geometry for this specific trip
                        SELECT vo.vehicle_id, t.shape_id, s.geom as shape_geom
                        FROM bus.vehicle_observation vo
                        JOIN gtfs.trips t ON vo.trip_id = t.trip_id
                        JOIN gtfs.shapes s ON t.shape_id = s.shape_id
                        WHERE vo.trip_id = %s 
                        AND vo.observed_at::date = %s::date
                        AND vo.vehicle_id IS NOT NULL
                        LIMIT 1
                    ),
                    all_pings AS (
                        -- Get every ping for this vehicle today, mapped as fractions (0-1) along the shape
                        SELECT 
                            vo.observed_at,
                            ST_LineLocatePoint(ti.shape_geom, vo.geom) as fraction
                        FROM bus.vehicle_observation vo
                        JOIN trip_identity ti ON vo.vehicle_id = ti.vehicle_id
                        WHERE vo.trip_id = %s 
                        AND vo.observed_at::date = %s::date
                        -- Within 50 meters constraint
                        AND ST_DWithin(vo.geom::geography, ti.shape_geom::geography, 50)
                    ),
                    stop_distances AS (
                        -- Get the planned stop distances converted to fractions
                        SELECT 
                            ss.stop_id,
                            ss.stop_sequence,
                            ss.shape_dist_traveled / NULLIF(MAX(ss.shape_dist_traveled) OVER(), 0) as stop_frac
                        FROM gtfs.shape_stops ss
                        JOIN trip_identity ti ON ss.shape_id = ti.shape_id
                    ),
                    interpolated_times AS (
                        -- For every stop, find the closest ping BEFORE and AFTER
                        SELECT 
                            sd.stop_id,
                            sd.stop_sequence,
                            (SELECT MAX(observed_at) FROM all_pings p WHERE p.fraction <= sd.stop_frac) as ping_a_time,
                            (SELECT MIN(observed_at) FROM all_pings p WHERE p.fraction > sd.stop_frac) as ping_b_time,
                            (SELECT MAX(fraction) FROM all_pings p WHERE p.fraction <= sd.stop_frac) as ping_a_frac,
                            (SELECT MIN(fraction) FROM all_pings p WHERE p.fraction > sd.stop_frac) as ping_b_frac
                        FROM stop_distances sd
                    ),
                    unique_observations AS (
                        SELECT DISTINCT ON (cur_stop_id) cur_stop_id, observed_at
                        FROM bus.vehicle_observation
                        WHERE trip_id = %s AND observed_at::date = %s::date
                        AND vehicle_id = (SELECT vehicle_id FROM trip_identity)
                        AND cur_stop_id IS NOT NULL
                        ORDER BY cur_stop_id, observed_at ASC
                    )
                    SELECT 
                        st.trip_id,
                        ti.vehicle_id,
                        uo.cur_stop_id AS real_stop_id, 
                        uo.observed_at AS real_arrival_time, 
                        st.stop_id AS planned_stop_id, 
                        s.stop_name AS planned_stop_name, 
                        st.arrival_time AS planned_arrival_time,
                        -- THE ESTIMATION LOGIC
                        CASE 
                            -- If we have a real arrival, use that
                            WHEN uo.observed_at IS NOT NULL THEN uo.observed_at
                            -- If gap is < 2.5 minutes, interpolate
                            WHEN (it.ping_b_time - it.ping_a_time) < interval '2.5 minutes' THEN
                                it.ping_a_time + (it.ping_b_time - it.ping_a_time) * ((si.stop_frac - it.ping_a_frac) / NULLIF(it.ping_b_frac - it.ping_a_frac, 0))
                            ELSE NULL
                        END as estimated_arrival_time
                    FROM gtfs.stop_times st
                    JOIN gtfs.stops s ON st.stop_id = s.stop_id
                    CROSS JOIN trip_identity ti
                    LEFT JOIN stop_distances si ON st.stop_id = si.stop_id AND st.stop_sequence = si.stop_sequence
                    LEFT JOIN interpolated_times it ON st.stop_id = it.stop_id AND st.stop_sequence = it.stop_sequence
                    LEFT JOIN unique_observations uo ON st.stop_id = uo.cur_stop_id
                    WHERE st.trip_id = %s
                    ORDER BY st.stop_sequence ASC
                """, (trip_id, date, trip_id, date, trip_id, date, trip_id))


                # If no observations found, trip_identity might be empty. 
                # In that case, it returns the planned schedule.
                rows = cur.fetchall()
                return [
                    TripExecution(
                        trip_id=row[0],
                        vehicle_id=row[1],
                        real_stop_id=row[2],
                        real_arrival_time=row[3],
                        planned_stop_id=row[4],
                        planned_stop_name=row[5],
                        planned_arrival_time=row[6],
                        estimated_arrival_time=row[7],
                    ) for row in rows
                ]
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class RouteInfo(BaseModel):
    route_id: str
    route_long_name: Optional[str]


class VehicleRouteHistory(BaseModel):
    date: str
    vehicle_id: str
    routes: List[RouteInfo]


@router.get("/history/vehicle", response_model=VehicleRouteHistory)
async def get_routes_by_vehicle_for_date(
    vehicle_id: str = Query(...),
    date: str = Query(...)
):
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT DISTINCT
                        o.route_id,
                        r.route_long_name
                    FROM bus.vehicle_observation o
                    LEFT JOIN gtfs.routes r ON o.route_id = r.route_id
                    WHERE o.vehicle_id = %s
                        AND o.observed_at >= %s AND o.observed_at < (%s::date + '1 day'::interval)
                    """, (vehicle_id, date, date))
                
                rows = cur.fetchall()

                routes = [
                    {"route_id": row[0], "route_long_name": row[1]} 
                    for row in rows
                ]

                return {
                    "date": date,
                    "vehicle_id": vehicle_id,
                    "routes": routes
                }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class RouteVehicleInfo(BaseModel):
    route_id: str
    route_long_name: Optional[str]
    vehicles: List[str]  # List of all vehicles on this route for the day

class GlobalRouteHistory(BaseModel):
    date: str
    routes: List[RouteVehicleInfo]

@router.get("/history/vehicles-by-route-by-date", response_model=GlobalRouteHistory)
async def get_routes_for_date(
    date: str = Query(..., examples=["2026-05-15"])
):
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # We use string_agg or array_agg to get all unique vehicles per route
                sql = """
                    SELECT 
                        o.route_id,
                        r.route_long_name,
                        ARRAY_AGG(DISTINCT o.vehicle_id) as vehicle_list
                    FROM bus.vehicle_observation o
                    LEFT JOIN gtfs.routes r ON o.route_id = r.route_id
                    WHERE o.observed_at >= %s 
                      AND o.observed_at < (%s::date + '1 day'::interval)
                    GROUP BY o.route_id, r.route_long_name
                    ORDER BY o.route_id ASC;
                """
                
                cur.execute(sql, (date, date))
                rows = cur.fetchall()

                routes = [
                    {
                        "route_id": row[0],
                        "route_long_name": row[1] or "Unknown Route",
                        "vehicles": row[2] if row[2] is not None else []
                    } 
                    for row in rows
                ]

                return {
                    "date": date,
                    "routes": routes
                }
            
    except Exception as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

class RouteSummary(BaseModel):
    route_id: str
    route_short_name: Optional[str] = "Unknown Route"
    route_long_name: Optional[str] = "Unknown Route"
    route_first_observed: Optional[datetime] = None
    route_last_observed: Optional[datetime] = None

class VehicleActivity(BaseModel):
    vehicle_id: str
    vehicle_license_plate: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_fuel: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_chassis_year: Optional[int] = None
    routes: List[RouteSummary]

class VehicleDailyHistory(BaseModel):
    date: str
    vehicles: List[VehicleActivity]

@router.get("/history/vehicle-daily", response_model=VehicleDailyHistory)
async def get_all_vehicles_daily_activity(
    date: str = Query(..., examples=["2026-05-15"])
):
     
    sql = """
        WITH route_bounds AS (
            SELECT 
                o.vehicle_id,
                o.route_id,
                MIN(o.observed_at) as first_seen,
                MAX(o.observed_at) as last_seen
            FROM bus.vehicle_observation o
            WHERE o.observed_at >= %s 
              AND o.observed_at < (%s::date + '1 day'::interval)
            GROUP BY o.vehicle_id, o.route_id
        )
        SELECT 
            rb.vehicle_id,
            f.vehicle_license_plate,
            f.vehicle_type,
            f.vehicle_fuel,
            f.vehicle_model,
            f.vehicle_chassis_year,
            jsonb_agg(jsonb_build_object(
                'route_id', rb.route_id,
                'route_short_name', COALESCE(r.route_short_name, 'Unknown Route'),
                'route_long_name', COALESCE(r.route_long_name, 'Unknown Route'),
                'route_first_observed', rb.first_seen,
                'route_last_observed', rb.last_seen
            ) ORDER BY rb.first_seen ASC) as route_list
        FROM route_bounds rb
        LEFT JOIN gtfs.routes r ON rb.route_id = r.route_id
        LEFT JOIN bus.fleet f ON rb.vehicle_id = f.vehicle_id
        GROUP BY 
            rb.vehicle_id, 
            f.vehicle_license_plate, 
            f.vehicle_type, 
            f.vehicle_fuel, 
            f.vehicle_model, 
            f.vehicle_chassis_year
        ORDER BY rb.vehicle_id ASC;
    """
    
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (date, date))
                rows = cur.fetchall()

                # Process rows into the Pydantic model structure
                vehicle_data = [
                    {
                        "vehicle_id": row[0],
                        "vehicle_license_plate": row[1],
                        "vehicle_type": row[2],
                        "vehicle_fuel": row[3],
                        "vehicle_model": row[4],
                        "vehicle_chassis_year": row[5],
                        "routes": row[6] if row[6] is not None else [] # row[6] is already a list of dicts from jsonb_agg
                    }
                    for row in rows
                ]

                return {
                    "date": date,
                    "vehicles": vehicle_data
                }
            
                # Resulting JSON structure:
                # {
                #   "date": "2026-05-15",
                #   "vehicles": [
                #     {
                #       "vehicle_id": "2105",
                #       "vehicle_license_plate": "AA-00-AA",
                #       "vehicle_type": "articulated",
                #       "vehicle_fuel": "CNG",
                #       "vehicle_model": "MAN Lion's City G CNG",
                #       "vehicle_chassis_year": 2015,
                #       "routes": [
                #         {"route_id": "701", "route_short_name": "701", "route_long_name": "Bolhão - Ermesinde", 
                # "route_first_observed": "2026-05-16T09:00:20", "route_last_observed": "2026-05-16T15:00:20"},
                #         {"route_id": "704", "route_short_name": "704", "route_long_name": "Boavista - Codiceira"
                # "route_first_observed": "2026-05-16T09:00:20", "route_last_observed": "2026-05-16T15:00:20"},
                #       ]
                #     }
                #   ]
                # }
                            
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch fleet activity.")
    


class RouteSnapshot(BaseModel):
    observed_at: datetime
    direction: int
    vehicle_id: str
    last_stop_id: Optional[str]
    cur_stop_id: Optional[str]
    trip_id: Optional[str]
    trip_headsign: Optional[str]

@router.get("/history/route-snapshot", response_model=List[RouteSnapshot])
async def get_route_observations_snapshot(
    route_id: str = Query(...),
    date: str = Query(...), # Format: YYYY-MM-DD
    time: str = Query("00:00")
):
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT DISTINCT ON (o.vehicle_id)
                        o.observed_at,
                        o.vehicle_id, 
                        o.direction, 
                        o.last_stop_id, 
                        o.cur_stop_id,
                        t.trip_id,
                        t.trip_headsign
                    FROM bus.vehicle_observation o
                    LEFT JOIN gtfs.trips t ON o.trip_id = t.trip_id
                    WHERE o.route_id = %s 
                        AND o.observed_at >= (%s::date + %s::time) - INTERVAL '2 minutes'
                        AND o.observed_at <= (%s::date + %s::time)
                    ORDER BY o.vehicle_id, o.observed_at DESC;
                    """

                cur.execute(sql, (route_id, date, time, date, time, ))
                rows = cur.fetchall()

                return [
                    RouteSnapshot(
                        observed_at=row[0],
                        vehicle_id=row[1],
                        direction=row[2],
                        last_stop_id=row[3],
                        cur_stop_id=row[4],
                        trip_id=row[5],
                        trip_headsign=row[6]
                    ) for row in rows
                ]

    except Exception as e:
        print(f"History Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))