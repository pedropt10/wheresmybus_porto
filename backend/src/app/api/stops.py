import psycopg
from fastapi import APIRouter, HTTPException, Query
from app.config import settings

router = APIRouter()

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
        with psycopg.connect(settings.database_url) as conn:
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
        with psycopg.connect(settings.database_url) as conn:
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
