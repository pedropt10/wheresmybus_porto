import json
import os
import psycopg
from fastapi import APIRouter, HTTPException, Query
from app.config import settings

router = APIRouter()
DATABASE_URL = os.environ["DATABASE_URL"]

@router.get("/shapes/route")
async def get_shape_by_route(
    route_id: str = Query(..., examples=["704"]), 
    direction_id: int = Query(..., examples=[0, 1]),
    variant_id: int = 0
):
    query = """
        SELECT ST_AsGeoJSON(s.geom), r.route_color 
        FROM gtfs.shapes s
        LEFT JOIN gtfs.routes r ON s.route_id = r.route_id
        WHERE s.route_id = %s AND s.direction_id = %s AND s.variant_id = %s
        LIMIT 1;
    """
    
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(query, (route_id, direction_id, variant_id))
                row = cur.fetchone()
                
                if not row:
                    return {"coordinates": [], "color": "#187EC2"}
                
                geojson = json.loads(row[0])
                # Flip [lon, lat] from PostGIS to [lat, lon] for Leaflet
                coords = [[p[1], p[0]] for p in geojson["coordinates"]]
                
                # Ensure color has the '#' prefix
                color = row[1] if row[1] else "187EC2"
                if not color.startswith("#"):
                    color = f"#{color}"
                
                return {
                    "coordinates": coords,
                    "color": color
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/shapes/trip")
async def get_shape_by_trip(
    trip_id: str = Query(..., examples=["503_0_1|223|D3|T1|N8"]),
    acceptTripFromOtherServiceCalendar: bool = Query(True, description="Allow fallback shapes with other service calendars")
):
    
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
                    SELECT ST_AsGeoJSON(s.geom) 
                    FROM gtfs.shapes s
                    LEFT JOIN gtfs.trips t ON s.shape_id = t.shape_id
                    WHERE t.trip_id = %s
                    LIMIT 1;
                """

                with conn.cursor() as cur:
                    cur.execute(query, (current_trip_id.strip(), ))
                    row = cur.fetchone()

                    if row:
                        geojson = json.loads(row[0])
                        # Flip [lon, lat] from PostGIS to [lat, lon] for Leaflet
                        coords = [[p[1], p[0]] for p in geojson["coordinates"]]
                        return { "coordinates": coords }
                    
                    # If not found, we do NOTHING here so the loop continues to the next offset

            # If we finish the loop without returning, nothing was found
            raise HTTPException(status_code=404, detail="No trip shape found after checking fallbacks")
    
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shapes/shape_id/route")
async def get_main_shape_ids_by_route(
    route_id: str = Query(..., examples=["801"]), 
):
    query = """
        SELECT
            s.shape_id
        FROM gtfs.shapes s
        WHERE s.route_id = %s
            AND s.variant_id = 0
    """
    
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(query, (route_id, ))
                rows = cur.fetchall()
                
                return [
                    {
                        "shape_id": row[0]
                    } for row in rows
                ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
