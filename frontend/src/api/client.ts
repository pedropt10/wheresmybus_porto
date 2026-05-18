// ==================================
//      OBSERVATIONS / HISTORY
// ==================================

export type VehicleLatest = {
  vehicle_id: string | null;
  route_id: string | null;
  direction: number | null;
  trip_id: string | null;
  heading: number | null;
  observed_at: string;
  lon: number;
  lat: number;
  last_stop_id: string | null;
  last_stop_name: string | null;
  cur_stop_id: string | null;
  
  route_short_name?: string | null;
  route_long_name: string | null;
  trip_headsign: string | null;

  prev_observed_at: string | null;
  prev_lon: number | null;
  prev_lat: number | null;
  prev_heading: number | null;

};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function fetchLatest(routeId?: string, direction?: number | null): Promise<VehicleLatest[]> {
  const url = new URL(`${API_BASE}/api/latest`);
  if (routeId && routeId.trim().length > 0) url.searchParams.set("route", routeId.trim());
  if (direction === 0 || direction === 1) url.searchParams.set("direction", String(direction));

  // cache buster to force a new response every time
  url.searchParams.set("_ts", String(Date.now()));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch latest: ${res.status}`);
  return res.json();
}


export async function fetchHistory(params: {
  mode: "trip" | "route";
  route_id: string;
  date: string;
  trip_id?: string;
  start_time?: string;
  end_time?: string;
}): Promise<VehicleLatest[]> 
{
  const query = new URLSearchParams(params as any).toString();
  const res = await fetch(`${API_BASE}/api/history?${query}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export interface RouteSummary {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_first_observed: string;
  route_last_observed: string;
}

export interface VehicleActivity {
  vehicle_id: string;
  vehicle_license_plate: string;
  vehicle_type: string;
  vehicle_fuel: string;
  vehicle_model: string;
  vehicle_chassis_year: number;
  routes: RouteSummary[]; // The nested routes from your jsonb_agg
}

export interface VehicleDailyHistoryResponse {
  date: string;
  vehicles: VehicleActivity[];
}

export async function fetchVehicleDailyHistory(date: string): Promise<VehicleDailyHistoryResponse | null> {
  const url = new URL(`${API_BASE}/api/history/vehicle-daily`);
  url.searchParams.set("date", date);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      console.warn("Fetch vehicles daily history returned non-OK status:", res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Error fetching vehicle daily history:", err);
    return null;
  }
}


// class RouteHistorySnapshot(BaseModel):
//     observed_at: datetime
//     direction: int
//     vehicle_id: str
//     last_stop_id: Optional[str]
//     cur_stop_id: Optional[str]
//     trip_id: Optional[str]
//     trip_headsign: Optional[str]

// @router.get("/history/route-snapshot", response_model=List[RouteHistorySnapshot])
// async def get_route_history_snapshot(
//     route_id: str = Query(...),
//     date: str = Query(...), # Format: YYYY-MM-DD
//     time: Optional[str] = Query("00:00")
// ):


export interface RouteSnapshot {
  observed_at: string;
  direction: number;
  vehicle_id: string;
  last_stop_id?: string;
  cur_stop_id?: string;
  trip_id?: string;
  trip_headsign?: string;
}

export async function fetchRouteSnapshot(routeId: string, date: string, time: string): Promise<RouteSnapshot[] | null> {
  const url = new URL(`${API_BASE}/api/history/route-snapshot`);
  url.searchParams.set("route_id", routeId);
  url.searchParams.set("date", date);
  url.searchParams.set("time", time);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      console.warn("Fetch route observations snapshot returned non-OK status:", res.status);
      return null;
    }
    return (await res.json()) as RouteSnapshot[];
  } catch (err) {
    console.error("Error fetching route observations snapshot for route", routeId, "on date", date, "and time", time, ":", err);
    return null;
  }
}

// ==================================
//              SHAPES
// ==================================

export type RouteShape = {
  coordinates: [number, number][];
  color: string;
};

export async function fetchRouteShape(routeId: string, directionId: number | null): Promise<RouteShape | null> {
  if (!routeId || directionId === null) return null;
  
  const url = new URL(`${API_BASE}/api/shapes/route`);
  url.searchParams.set("route_id", routeId.trim());
  url.searchParams.set("direction_id", String(directionId));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error("Error fetching route shape:", err);
    return null;
  }
}

export type TripShape = {
  coordinates: [number, number][];
};

export async function fetchTripShape(
  tripId: string, 
  acceptTripFromOtherServiceCalendar: boolean
): Promise<TripShape | null> {
  if (!tripId) return null;
  
  const url = new URL(`${API_BASE}/api/shapes/trip`);
  url.searchParams.set("trip_id", tripId.trim());
  url.searchParams.set("acceptTripFromOtherServiceCalendar", String(acceptTripFromOtherServiceCalendar));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error("Error fetching shape for trip_id", tripId, ":", err);
    return null;
  }
}

export type ShapeIdItem = {
  shape_id: string; 
};

// Array of shape_id string items
export type ShapeIdsResponse = ShapeIdItem[];

export async function fetchMainShapeIdsRoute(routeId: string): Promise<ShapeIdsResponse | null> {
  if (!routeId) return null;
  
  const url = new URL(`${API_BASE}/api/shapes/shape_id/route`);
  url.searchParams.set("route_id", routeId.trim());

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ShapeIdsResponse;
  } catch (err) {
    console.error("Error fetching shape_ids for route", routeId, ":", err);
    return null;
  }
}

// ==================================
//              ROUTES
// ==================================

export interface AllRoutes {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
}

export async function fetchAllRoutes(): Promise<any[]> {
  const url = new URL(`${API_BASE}/api/routes`);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      console.warn("Fetch routes returned non-OK status:", res.status);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("Error fetching all routes:", err);
    return [];
  }
}

// ==================================
//              STOPS
// ==================================

export type Stop = {
  stop_id: string;
  stop_name: string;
  lat: number;
  lon: number;
  zone_id: string;
  stop_url: string;
};

export async function fetchStops(routeId: string, directionId: number | null): Promise<Stop[]> {
  if (!routeId || directionId === null) return [];

  const url = new URL(`${API_BASE}/api/stops/route`);
  url.searchParams.set("route_id", routeId.trim());
  url.searchParams.set("direction_id", String(directionId));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch stops: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Error fetching stops:", err);
    return [];
  }
}

export async function fetchTripStops(
  tripId: string, 
  acceptTripFromOtherServiceCalendar: boolean
): Promise<Stop[]> {
  if (!tripId) return [];

  const url = new URL(`${API_BASE}/api/stops/trip`);
  url.searchParams.set("trip_id", tripId.trim());
  url.searchParams.set("acceptTripFromOtherServiceCalendar", String(acceptTripFromOtherServiceCalendar));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    console.error("Error fetching trip shape:", err, "for trip_id:", tripId);
    return [];
  }
}

// ==================================
//         PLANNED STOP_TIMES
// ==================================

export type StopPlannedArrival = {
  route_id: string;
  trip_headsign: string;
  arrival_time: string;
};

export async function fetchPlannedArrivals(stopId: string): Promise<StopPlannedArrival[]> {
  const url = new URL(`${API_BASE}/api/arrivals/${stopId}`);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("Error fetching planned arrivals:", err);
    return [];
  }
}


export async function fetchAvailableTrips(route_id: string, date: string): Promise<string[]> {
  const url = new URL(`${API_BASE}/api/history/trips-list?route_id=${route_id}&date=${date}`);
  console.log("Fetching trips from:", url); // Debug the actual URL
  const res = await fetch(url);
  
  if (!res.ok) {
    console.error("Trip fetch failed with status:", res.status);
    throw new Error("Failed to fetch trip list");
  }
  return res.json();
}

export type ScheduledTimetable = {
    trip_id: string;
    arrival_time: string;
    stop_id: string;
    stop_name: string;
    stop_sequence: number;
}

export type ReferenceStop = {
    stop_id: string;
    stop_name: string;
    stop_sequence: number;
};

export type TimetableResponse = {
    reference_stops: ReferenceStop[];
    trips: ScheduledTimetable[];
};

export async function fetchDailyTimetable(
  date: string, 
  route_id: string, 
  direction_id: number
): Promise<TimetableResponse> {
  const url = new URL(`${API_BASE}/api/schedules/daily?date=${date}&route_id=${route_id}&direction_id=${direction_id}`);
  console.log("Fetching timetable from:", url);
  const res = await fetch(url);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("Timetable fetch failed:", res.status, errorData.detail);
    throw new Error(errorData.detail || "Failed to fetch timetable");
  }
  return res.json();
}


// ==================================
//          REAL STOP_TIMES
// ==================================

export type TripExecution = { 
    trip_id: string;
    vehicle_id: string | null;
    real_stop_id: string | null;
    real_arrival_time: string | null;
    estimated_arrival_time: string | null;
    planned_stop_id: string;
    planned_stop_name: string;
    planned_arrival_time: string;
};

export async function fetchTripExecution(
  trip_id: string, 
  date: string, 
): Promise<TripExecution[]> {
  const url = new URL(`${API_BASE}/api/history/trip-execution?date=${date}&trip_id=${trip_id}`);
  console.log("Fetching trip real-time execution from:", url);
  const res = await fetch(url);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("Trip real-time execution fetch failed:", res.status, errorData.detail);
    throw new Error(errorData.detail || "Failed to fetch trip real-time execution");
  }
  return res.json();
}

export type RouteInfo = {
    route_id: string;
    route_long_name: string;
};

export type VehicleRouteHistory = {
    vehicle_id: string;
    date: string;
    routes: RouteInfo[];
};

export async function fetchVehicleRouteHistory(
  vehicle_id: string, 
  date: string, 
): Promise<VehicleRouteHistory> {
  const url = new URL(`${API_BASE}/api/history/vehicle?vehicle_id=${vehicle_id}&date=${date}`);
  console.log("Fetching vehicle route history from:", url);
  const res = await fetch(url);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("Vehicle route history fetch failed:", res.status, errorData.detail);
    throw new Error(errorData.detail || "Failed to fetch vehicle route history");
  }
  return res.json();
}

// ==================================
//             HEADSIGNS
// ==================================

export type TripOriginResponse = {
    trip_id: string;
    origin_stop_name: string;
};

export async function fetchTripOrigin(
  trip_id: string, 
  acceptTripFromOtherServiceCalendar: boolean
): Promise<TripOriginResponse> {

  const url = new URL(`${API_BASE}/api/trips/origin`);
  url.searchParams.set("trip_id", trip_id.trim());
  url.searchParams.set("acceptTripFromOtherServiceCalendar", String(acceptTripFromOtherServiceCalendar));

  console.log("Fetching trip origin stop from:", url); // Debug the actual URL
  const res = await fetch(url);
  
  if (!res.ok) {
    console.error("Trip origin stop fetch failed with status:", res.status);
    throw new Error("Failed to fetch trip origin stop");
  }
  return res.json();
}

// export type TripHeadsignResponse = {
//   trip_headsign: string;
// };

// export async function fetchTripHeadsign(tripId: string): Promise<string | null> {
//   if (!tripId) return null;

//   // matches your pattern: ${API_BASE}/api/trips/${tripId}/headsign
//   const url = `${API_BASE}/api/trips/${encodeURIComponent(tripId)}/headsign`;

//   try {
//     const res = await fetch(url, { cache: "force-cache" }); // Headsigns rarely change, caching is good here
//     if (!res.ok) {
//         if (res.status === 404) return null;
//         throw new Error(`Failed to fetch headsign: ${res.status}`);
//     }
//     const data: TripHeadsignResponse = await res.json();
//     return data.trip_headsign;
//   } catch (err) {
//     console.error("Error fetching trip headsign:", err);
//     return null;
//   }
// }


// ==================================
//            VEHICLES
// ==================================

export interface AllVehicles {
  vehicle_id: string;
  vehicle_license_plate: string;
  vehicle_type: string;
  vehicle_fuel: string;
  vehicle_model: string;
  vehicle_chassis_year: number;
}

export async function fetchAllVehicles(): Promise<AllVehicles[]> {
  const url = new URL(`${API_BASE}/api/vehicle`);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      console.warn("Fetch vehicles returned non-OK status:", res.status);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("Error fetching all vehicles:", err);
    return [];
  }
}


// ==================================
//           SHAPE SPINES
// ==================================

// class StopPoint(BaseModel):
//     stop_id: str
//     stop_name: str
//     coordinates: List[float]  # [longitude, latitude]

// class ShapeSpineResponse(BaseModel):
//     shape_id: str
//     direction_id: Optional[int] = None
//     # We use Dict[str, Any] because PostGIS delivers native GeoJSON geometry dictionaries
//     geometry: Dict[str, Any]  
//     stops: List[StopPoint]

export interface StopPoint {
  stop_id: string;
  stop_name: string;
  coordinates: [number, number];
  distance_percentage: number;
}

export interface ShapeSpine {
  shape_id: string;
  direction_id: number;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  stops: StopPoint[];
}

export async function fetchShapeSpine(shapeId: string): Promise<ShapeSpine> {

  const url = new URL(`${API_BASE}/api/stops/shape-spines`);
  url.searchParams.set("shape_id", shapeId.trim());

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch shape spines: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Error fetching shape spines:", err);
    throw new Error("Failed to fetch shape spines for shape_id" + shapeId);
  }
}
