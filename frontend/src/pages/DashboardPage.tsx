import React, { useState, useEffect, useMemo } from "react";
import { fetchAllRoutes, fetchShapeSpine, fetchMainShapeIdsRoute, fetchRouteSnapshot, 
    type AllRoutes, type ShapeSpine, type RouteSnapshot } from "../api/client";
import { RouteSelector } from "../components/RouteSelector";
import { getRouteColors } from "../components/Map";
import { useLanguage } from "../context/LanguageContext";
import { RouteDashboard } from "../components/RouteDashboard";

export function DashboardPage() {
    const { t } = useLanguage();

    // Search Inputs
    const [allRoutes, setAllRoutes] = useState<AllRoutes[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTime, setSelectedTime] = useState(() => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`; // e.g., "19:30"
    });

    // Results
    const [ShapeSpineL, setShapeSpineL] = useState<ShapeSpine | null>(null);
    const [ShapeSpineR, setShapeSpineR] = useState<ShapeSpine | null>(null);
    const [selectedRouteSnapshot, setSelectedRouteSnapshot] = useState<RouteSnapshot[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedRouteColors, setRouteColors] = useState({ bgColor: 'transparent', textColor: 'inherit' });    

    const convertPTToUTC = (dateStr: string, timeStr: string): string => {
        // 1. Combine them into a single string parsing it explicitly in the Europe/Lisbon timezone
        const localDateTime = new Date(`${dateStr}T${timeStr}:00`);
        
        // 2. Convert that exact moment to an ISO string, which converts it to UTC automatically
        return localDateTime.toISOString(); // e.g., "2026-05-18T18:30:00.000Z"
    };

    // Fetch the routes once when the page mounts
    useEffect(() => {
    async function loadRoutes() {
        try {
        const data = await fetchAllRoutes();
        setAllRoutes(data);
        } catch (e) {
        console.error("Could not load routes list", e);
        }
    }
    loadRoutes();
    }, []);

    useEffect(() => {
        console.log("Checking for vehicles:", { selectedRoute, selectedDate });
        fetchAllRoutes().then(setAllRoutes).catch(console.error);
    }, []);

    const handleSearch = async () => {

        // Reset UI state. Clear the page immediately.
        setShapeSpineL(null);
        setShapeSpineR(null);
        setLoading(true);
        try {
            
            let shapeIds = null;
            // Fetch main shape ids for route only if selectedRoute is not null
            if (selectedRoute) {
                shapeIds = await fetchMainShapeIdsRoute(selectedRoute);
            }

            const shapeIdL = shapeIds?.[0]?.shape_id;
            const shapeIdR = shapeIds?.[1]?.shape_id;

            // For each search, we must obtain the shape spines for directions 0 and 1, 
            // to be displayed side-by-side on the route dashboard. 
            if (shapeIdL) {
                const dataL = await fetchShapeSpine(shapeIdL);
                setShapeSpineL(dataL);
            } else {
                setShapeSpineL(null); // Clear previous state if no left spine exists
            }

            if (shapeIdR) {
                const dataR = await fetchShapeSpine(shapeIdR);
                setShapeSpineR(dataR);
            } else {
                setShapeSpineR(null); // Clear previous state if no right spine exists
            }

            let selectedTimeUTC = "";
            if (selectedDate && selectedTime) {
                selectedTimeUTC = convertPTToUTC(selectedDate, selectedTime);
            } else {
                const now = new Date();
                const todays_date = new Date().toISOString().split('T')[0];
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                selectedTimeUTC = convertPTToUTC(todays_date, `${hh}:${mm}`);
            }

            if (selectedRoute && selectedDate) {
                const selectedRouteSnapshot = await fetchRouteSnapshot(selectedRoute, selectedDate, selectedTimeUTC);
                
                if (selectedRouteSnapshot) {
                    setSelectedRouteSnapshot(selectedRouteSnapshot);
                }
            }

            const selectedRouteColors = getRouteColors(selectedRoute, 0);
            setRouteColors({
                bgColor: selectedRouteColors.bgColor || 'transparent',
                textColor: selectedRouteColors.textColor || 'var--(text-main)'
            });

            // // // Fetch Route Colors - temporarily disabled while 205 is the test bed
            // if (selectedRoute) {
            // const selectedRouteColors = getRouteColors(selectedRoute, 0);
            // setRouteColors({
            //     bgColor: selectedRouteColors.bgColor || 'transparent',
            //     textColor: selectedRouteColors.textColor || 'var--(text-main)'
            // });
            // }

        } catch (e) {
            console.error("Search error:", e);
            alert(t("alert_search_failed"));
        } finally {
            setLoading(false);
        }
    };

    // // Client-side quick filter matching route IDs inside the vehicles array
    // const filteredVehicles = useMemo(() => {
    //     if (!VehicleDailyHistory?.vehicles) return [];
        
    //     // If no route is selected (or it's cleared/empty string), show all vehicles
    //     if (!selectedRoute) return VehicleDailyHistory.vehicles;

    //     return VehicleDailyHistory.vehicles.filter((vehicle) => {
    //         // Check if the vehicle has been active on the selected route id
    //         return vehicle.routes?.some((r: any) => String(r.route_id) === String(selectedRoute));
    //     });
    // }, [VehicleDailyHistory, selectedRoute]);

    return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "auto" }}>

        {/* Search Controls */}
        <div style={{ padding: "15px", display: "flex", gap: "10px", flexWrap: "wrap", 
        alignItems: "flex-end", background: "var(--bg-sub-header)", borderBottom: "1px solid var(--border-color)",
        flexShrink: 0 }}>
            <div className="field">
                <label style={styles.label}>{t("gen_route")}</label>
                    <RouteSelector
                        selectedRoute={selectedRoute}
                        onRouteChange={setSelectedRoute}
                        allRoutes={allRoutes}
                    />
            </div>

        <div className="field">
            <label style={styles.label}>{t("gen_date")}</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={styles.select} />
        </div>

        <button onClick={handleSearch} disabled={loading} style={styles.button}>
            {loading ? t("gen_searching") : t("gen_go")}
        </button>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <section>
                <RouteDashboard
                    outboundSpine={ShapeSpineL}
                    inboundSpine={null}
                    selectedRoute={selectedRoute}
                    selectedRouteColors={selectedRouteColors}
                    routeSnapshot={selectedRouteSnapshot}
                >
                </RouteDashboard>
            </section>
            <section>
                <RouteDashboard
                    outboundSpine={null}
                    inboundSpine={ShapeSpineR}
                    selectedRoute={selectedRoute}
                    selectedRouteColors={selectedRouteColors}
                    routeSnapshot={selectedRouteSnapshot}
                >
                </RouteDashboard>
            </section>
        </div>
        <div style={{ minHeight: "60px" }}>&nbsp;</div>

        {/* <div style={{ padding: "10px", fontSize: "12px" , color: "var(--text-secondary)" }}>
            ℹ️ {t("fleet_dash_legend")}
        </div> */}

        {/* <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {filteredVehicles.map((v) => (
                <VehicleBanner key={v.vehicle_id} vehicle={v} selectedRoute={selectedRoute} />
            ))}
            
            {!loading && filteredVehicles.length === 0 && (
                <div style={{ textAlign: "center", color: "#888", marginTop: "40px" }}>
                    {t("fleet_no_vehicles_found")}
                </div>
            )}
        </div> */}

        <div style={{ minHeight: "60px"}}>&nbsp;</div>

    </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    
  button: {
    padding: "8px 16px", background: "var(--bg-button)", color: "var(--text-main)",
    border: "none", borderRadius: "4px", cursor: "pointer" },

  input: { 
    padding: "6px 8px", border: "1px solid var(--border-color)", borderRadius: 6, minWidth: 120,
    background: "var(--bg-input-select)", color: "var(--text-main)" },

  label: { 
    display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" },

  select: { position: "relative",  display: "flex", alignItems: "center",
            background: "var(--bg-input-select)", border: "1px solid var(--border-color)", borderRadius: 4,
            padding: "2px 4px", minHeight: 30, minWidth: 120, cursor: "text", color: "var(--text-main)" },
            
};