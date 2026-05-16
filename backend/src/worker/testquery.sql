-- Test Queries for GTFS and Vehicle Data

-- SELECT * FROM bus.vehicle_latest
-- WHERE route_id = '205'

SELECT COUNT(*) FROM bus.vehicle_observation;

-- SELECT * FROM bus.vehicle
-- WHERE observed_at = '2026-04-01'

SELECT * FROM bus.vehicle_observation
-- WHERE observed_at >= '2026-04-19 18:00'
WHERE observed_at >= '2026-04-20 23:31:00'
-- AND vehicle_id = '3504'
-- AND trip_id = '205_0_1|223|D3|T1|N15'
-- AND cur_stop_id IS NOT NULL
-- AND last_stop_id IS NOT NULL
-- LIMIT 60

SELECT * FROM gtfs.shapes
-- LIMIT 20
-- WHERE shape_id = '205_0_1|0'
WHERE shape_id = '300_0_3|0';

SELECT * FROM gtfs.shape_stops
WHERE shape_id = '300_0_3|0'
-- ORDER BY shape_dist_traveled ASC

SELECT * FROM gtfs.shape_stops ss
LEFT JOIN gtfs.trips t ON t.shape_id = ss.shape_id
WHERE t.trip_id = '205_0_1|223|D3|T1|N15'

SELECT * FROM gtfs.stops
WHERE stop_id = 'HSJ8';

-- SELECT * FROM gtfs.service_by_date
-- WHERE date >= '2026-03-29' AND date <= '2026-04-04'
-- ORDER BY date ASC
-- WHERE (service_id != 'ELECUTEIS'
-- AND service_id != 'ELECSAB'
-- AND service_id != 'ELECDOM')

-- SELECT 
--     service_id, 
--     COUNT(DISTINCT trip_id) AS total_trips
-- FROM 
--     gtfs.trips
-- GROUP BY 
--     service_id
-- ORDER BY 
--     total_trips DESC;

-- SELECT 
--     r.route_short_name, 
--     t.trip_headsign,
--     st.arrival_time,
--     t.service_id
-- SELECT *
-- FROM gtfs.stop_times st
-- JOIN gtfs.trips t ON st.trip_id = t.trip_id
-- -- JOIN gtfs.routes r ON t.route_id = r.route_id
-- JOIN gtfs.service_by_date sbd ON t.service_id = sbd.service_id
-- -- WHERE st.stop_id = 'BRCV' 
-- WHERE sbd.date = '2026-04-15'
-- -- AND r.route_short_name = '704'
-- AND st.arrival_time::INTERVAL >= '18:00:00'::INTERVAL 
-- AND st.arrival_time::INTERVAL <= '19:59:00'::INTERVAL
-- ORDER BY st.arrival_time::INTERVAL ASC
-- LIMIT 10;

-- SELECT direction_id, COUNT(*) 
-- FROM gtfs.shapes 
-- GROUP BY direction_id;

-- UPDATE gtfs.shapes
-- SET direction_id = CASE 
--     WHEN direction_id = 1 THEN 0
--     WHEN direction_id = 2 THEN 1
--     WHEN direction_id = 3 THEN 0
--     ELSE direction_id -- Keeps other values (like 0) unchanged
-- END
-- WHERE direction_id IN (1, 2, 3);

SELECT * FROM gtfs.trips
WHERE route_id = '303'
-- WHERE trip_id = '205_0_2|220|D2|T3|N9'

SELECT * FROM bus.fleet


DROP TABLE bus.fleet CASCADE;

SELECT 
    o.vehicle_id,
    f.vehicle_license_plate,
    f.vehicle_type,
    f.vehicle_fuel,
    f.vehicle_model,
    f.vehicle_chassis_year,
    jsonb_agg(DISTINCT jsonb_build_object(
        'route_id', o.route_id,
        'route_long_name', COALESCE(r.route_long_name, 'Unknown Route')
    )) as route_list
FROM bus.vehicle_observation o
LEFT JOIN gtfs.routes r ON o.route_id = r.route_id
LEFT JOIN bus.fleet f ON o.vehicle_id = f.vehicle_id
WHERE o.observed_at >= '2026-05-15' 
    AND o.observed_at < ('2026-05-15'::date + '1 day'::interval)
GROUP BY 
    o.vehicle_id, 
    f.vehicle_license_plate, 
    f.vehicle_type, 
    f.vehicle_fuel, 
    f.vehicle_model, 
    f.vehicle_chassis_year
ORDER BY o.vehicle_id ASC;

SELECT * FROM gtfs.shapes
WHERE shape_id = '300_0_3|0'



WITH line_geom AS (
    -- 1. Grab the pre-compiled street route LineString directly
    SELECT 
        ST_AsGeoJSON(geom)::jsonb as line_geom
    FROM gtfs.shapes
    WHERE shape_id = '300_0_3|0'
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
    WHERE ss.shape_id = '300_0_3|0'
),
direction_lookup AS (
    -- 3. Grab the direction attribute if it exists via metadata logs
    SELECT direction_id 
    FROM gtfs.trips 
    WHERE shape_id = '300_0_3|0'
    LIMIT 1
)
SELECT 
    COALESCE((SELECT direction_id FROM direction_lookup), 0) as direction_id,
    (SELECT line_geom FROM line_geom) as geometry,
    COALESCE((SELECT stops FROM stop_list), '[]'::jsonb) as stops;