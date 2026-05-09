from fastapi import APIRouter, HTTPException, Path, Query
import psycopg
import os
from pydantic import BaseModel

router = APIRouter()
DATABASE_URL = os.environ["DATABASE_URL"]

class TripHeadsignResponse(BaseModel):
    trip_id: str
    trip_headsign: str

@router.get("/trips/headsign", response_model=TripHeadsignResponse)
async def get_trip_headsign(
    trip_id: str = Path(..., description="The GTFS trip_id (e.g. 12M_0_1|219|D2|T1|N9)")
):
    """
    Fetches the trip_headsign for a specific trip_id from the gtfs.trips table.
    """
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # trip_id is a Primary Key, so this lookup is extremely fast.
                cur.execute(
                    """
                    SELECT trip_id, trip_headsign 
                    FROM gtfs.trips 
                    WHERE trip_id = %s
                    """, 
                    (trip_id,)
                )
                
                row = cur.fetchone()
                
                if not row:
                    raise HTTPException(
                        status_code=404, 
                        detail=f"Trip ID '{trip_id}' not found in GTFS schedules."
                    )
                
                return TripHeadsignResponse(
                    trip_id=row[0],
                    trip_headsign=row[1]
                )

    except HTTPException:
        raise
    except Exception as e:
        # Log the error for internal debugging
        print(f"Error fetching trip headsign: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


class TripOriginResponse(BaseModel):
    trip_id: str
    origin_stop_name: str


@router.get("/trips/origin", response_model=TripOriginResponse)
async def get_trip_origin(
    trip_id: str = Query(..., examples=["503_0_1|223|D3|T1|N8"]),
    acceptTripFromOtherServiceCalendar: bool = Query(True, description="Allow fallback shapes with other service calendars")
):
    """
    Fetches the stop_name of the first stop for a specific trip_id from the gtfs.stop_times and gtfs.stops tables.
    If acceptTripFromOtherServiceCalendar is True, it will attempt to find a shape from subsequent service calendars.
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
                    SELECT s.stop_name
                    FROM gtfs.stop_times st
                    JOIN gtfs.stops s ON st.stop_id = s.stop_id
                    WHERE st.trip_id = %s
                    AND st.stop_sequence = 1
                """
                with conn.cursor() as cur:
                    cur.execute(query, (current_trip_id.strip(), ))
                    row = cur.fetchone()

                    if row:
                        return TripOriginResponse(
                            trip_id=trip_id,
                            origin_stop_name=row[0]
                        )
                    
    except HTTPException:
        raise

    except Exception as e:
        # Log the error for internal debugging
        print(f"Error fetching trip origin stop name: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

