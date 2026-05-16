import os
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import psycopg
from typing import List, Dict, Any, Optional

router = APIRouter()
DATABASE_URL = os.environ["DATABASE_URL"]

@router.get("/stops/route")
async def get_stops_by_route(
    route_id: str = Query(..., examples=["704"]), 
    direction_id: int = Query(..., examples=[0]),
    variant_id: int = 0
):
    """
    Fetches all stops for a specific route and direction, 
    ordered by their sequence in the trip.
    """
    query = """
        SELECT 
            s.stop_id, 
            s.stop_name, 
            s.stop_lat, 
            s.stop_lon, 
            s.zone_id, 
            s.stop_url
        FROM gtfs.stops s
        JOIN gtfs.shape_stops ss ON s.stop_id = ss.stop_id
        JOIN gtfs.shapes sh ON ss.shape_id = sh.shape_id
        WHERE sh.route_id = %s AND sh.direction_id = %s AND sh.variant_id = %s
        ORDER BY ss.stop_sequence;
    """
    
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(query, (route_id, direction_id, variant_id))
                rows = cur.fetchall()
                
                return [
                    {
                        "stop_id": row[0],
                        "stop_name": row[1],
                        "lat": row[2],
                        "lon": row[3],
                        "zone_id": row[4],
                        "stop_url": row[5]
                    } for row in rows
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/stops/trip")
async def get_stops_by_trip(
    trip_id: str = Query(..., examples=["503_0_1|223|D3|T1|N8"]),
    acceptTripFromOtherServiceCalendar: bool = Query(True, description="Allow fallback shapes with other service calendars")
):
       
    """
    Fetches all stops for a specific trip_id, ordered by their sequence in the trip.
    if acceptTripFromOtherServiceCalendar is True, it will attempt to find stops from subsequent service calendars.
    """

    trip_id_parts = trip_id.split("|")
    iterations = 20 if acceptTripFromOtherServiceCalendar and len(trip_id_parts) > 2 else 1

    try:
        with psycopg.connect(DATABASE_URL) as conn:
            for offset in range(iterations):
                
                if offset == 0:
                    current_trip_id = trip_id
                else:
                    # Increment the service calendar ID
                    try:
                        new_servcal_id = int(trip_id_parts[1]) + offset
                        current_trip_id = f"{trip_id_parts[0]}|{new_servcal_id}|{'|'.join(trip_id_parts[2:])}"
                    except ValueError:
                        break 

                query = """
                    SELECT 
                        s.stop_id, 
                        s.stop_name, 
                        s.stop_lat, 
                        s.stop_lon, 
                        s.zone_id, 
                        s.stop_url
                    FROM gtfs.stops s
                    JOIN gtfs.shape_stops ss ON s.stop_id = ss.stop_id
                    JOIN gtfs.trips t ON t.shape_id = ss.shape_id
                    WHERE t.trip_id = %s
                    ORDER BY ss.stop_sequence;
                """

                with conn.cursor() as cur:
                    cur.execute(query, (current_trip_id.strip(), ))
                    rows = cur.fetchall()

                if rows:
                    return [
                        {
                            "stop_id": row[0],
                            "stop_name": row[1],
                            "lat": row[2],
                            "lon": row[3],
                            "zone_id": row[4],
                            "stop_url": row[5]
                        } for row in rows
                    ]
                    
                # If not found, we do NOTHING here so the loop continues to the next offset

            # If we finish the loop without returning, nothing was found
            raise HTTPException(status_code=404, detail="No trip stops found after checking fallbacks")
    
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))


class StopPoint(BaseModel):
    stop_id: str
    stop_name: str
    coordinates: List[float]  # [longitude, latitude]

class ShapeSpineResponse(BaseModel):
    shape_id: str
    direction_id: Optional[int] = None
    # We use Dict[str, Any] because PostGIS delivers native GeoJSON geometry dictionaries
    geometry: Dict[str, Any]  
    stops: List[StopPoint]

@router.get("/stops/shape-spines", response_model=ShapeSpineResponse)
async def get_stop_spines_by_shape(
    shape_id: str = Query(..., examples=["300_0_3|0"]),
):
    """
    Fetches the precise spatial LineString path layout and ordered physical 
    passenger stops for a unique GTFS shape identifier.
    """
    query = """
        WITH line_geom AS (
            -- 1. Grab the pre-compiled street route LineString directly
            SELECT 
                ST_AsGeoJSON(geom)::jsonb as line_geom
            FROM gtfs.shapes
            WHERE shape_id = %s
            LIMIT 1
        ),
        stop_list AS (
            -- 2. Aggregate the passenger node points snapped along this shape itinerary
            SELECT 
                jsonb_agg(jsonb_build_object(
                    'stop_id', s.stop_id,
                    'stop_name', s.stop_name,
                    'coordinates', jsonb_build_array(s.stop_lon, s.stop_lat)
                ) ORDER BY ss.stop_sequence ASC) as stops
            FROM gtfs.shape_stops ss
            JOIN gtfs.stops s ON ss.stop_id = s.stop_id
            WHERE ss.shape_id = %s
        ),
        direction_lookup AS (
            -- 3. Grab the direction attribute if it exists via metadata logs
            SELECT direction_id 
            FROM gtfs.trips 
            WHERE shape_id = %s 
            LIMIT 1
        )
        SELECT 
            COALESCE((SELECT direction_id FROM direction_lookup), 0) as direction_id,
            (SELECT line_geom FROM line_geom) as geometry,
            COALESCE((SELECT stops FROM stop_list), '[]'::jsonb) as stops;
    """
    
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(query, (shape_id, shape_id, shape_id))
                row = cur.fetchone()
                
                if not row or row[1] is None:
                    raise HTTPException(
                        status_code=404, 
                        detail=f"Shape ID '{shape_id}' geometry records not found."
                    )
                
                return {
                    "shape_id": shape_id,
                    "direction_id": row[0],
                    "geometry": row[1],
                    "stops": row[2]
                }
            
                # Resulting ShapeSpineResponse JSON structure example:
                # {
                # "shape_id": "300_0_3|0",
                # "direction_id": 0,
                # "geometry": {
                #     "type": "LineString",
                #     "coordinates": [
                #     [-8.6112, 41.1499],
                #     [-8.6101, 41.1512],
                #     [-8.6085, 41.1530]
                #     ]
                # },
                # "stops": [
                #     {
                #     "stop_id": "PRL2",
                #     "stop_name": "Praça da Liberdade",
                #     "coordinates": [-8.6112, 41.1499]
                #     },
                #     {
                #     "stop_id": "TRD1",
                #     "stop_name": "Trindade",
                #     "coordinates": [-8.6101, 41.1512]
                #     }
                # ]
                # }

    except HTTPException:
        raise
    
    except Exception as e:
        print(f"Database error executing shape collection query: {e}")
        raise HTTPException(status_code=500, detail="Failed to compile shape spine data.")