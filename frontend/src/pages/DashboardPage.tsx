import React, { useState, useEffect, useMemo } from "react";
import { fetchAllRoutes, fetchShapeSpine, type AllRoutes, type ShapeSpine, type StopPoint } from "../api/client";
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

    // Results
    const [ShapeSpine0, setShapeSpine0] = useState<ShapeSpine | null>(null);
    const [ShapeSpine1, setShapeSpine1] = useState<ShapeSpine | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedRouteColors, setRouteColors] = useState({ bgColor: 'transparent', textColor: 'inherit' });    

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
        setShapeSpine0(null);
        setShapeSpine1(null);
        setLoading(true);
        try {
            
            // For each search, we must obtain the shape spines for directions 0 and 1. 

            // BETA - fetch shape stops spine for a fixed shape
            const data0 = await fetchShapeSpine("205_0_1|0");
            setShapeSpine0(data0);

            const data1 = await fetchShapeSpine("205_0_2|0");
            setShapeSpine1(data1);

            const selectedRouteColors = getRouteColors("205", 0);
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

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
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <section>
                <RouteDashboard
                    outboundSpine={ShapeSpine0}
                    inboundSpine={null}
                    selectedRoute={selectedRoute}
                    selectedRouteColors={selectedRouteColors}
                >
                </RouteDashboard>
            </section>
            <section>
                <RouteDashboard
                    outboundSpine={null}
                    inboundSpine={ShapeSpine1}
                    selectedRoute={selectedRoute}
                    selectedRouteColors={selectedRouteColors}
                >
                </RouteDashboard>
            </section>
        </div>

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