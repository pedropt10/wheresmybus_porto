import React, { useState, useEffect, useMemo } from "react";
import { fetchAllRoutes, fetchAvailableTrips, fetchHistory, fetchTripExecution, fetchTripShape, fetchTripStops, fetchTripOrigin, 
type AllRoutes, type VehicleLatest, type TripShape, type TripOriginResponse, type TripExecution, type Stop } from "../api/client";
import { HistoryMap } from "../components/HistoryMap";
import { TripSpine } from "../components/HistorySpine";
import { getRouteColors, getDirectionDestination } from "../components/Map";
import { useLanguage } from "../context/LanguageContext";

type Tab = "trip" | "route";

export function HistoryPage() {
  
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<Tab>("trip");
  const [allRoutes, setAllRoutes] = useState<AllRoutes[]>([]);
  
  // Search Inputs
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedTrip, setSelectedTrip] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("14:00");

  // Results
  const [historyData, setHistoryData] = useState<VehicleLatest[]>([]);
  const [availableTrips, setAvailableTrips] = useState<string[]>([]);
  const [tripOrigin, setTripOrigin] = useState<TripOriginResponse[]>([]);
  const [tripExecution, setTripExecution] = useState<TripExecution[]>([]);
  const [shape, setShape] = useState<TripShape | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRouteColors, setRouteColors] = useState({ bgColor: 'transparent', textColor: 'inherit' });


  useEffect(() => {
    fetchAllRoutes().then(setAllRoutes).catch(console.error);
  }, []);

  // Effect to fetch trips when parameters change
  useEffect(() => {
    console.log("Checking for trips:", { selectedRoute, selectedDate, activeTab });
    if (selectedRoute && selectedDate && activeTab === "trip") {
      fetchAvailableTrips(selectedRoute, selectedDate)
        .then(setAvailableTrips)
        .catch(() => setAvailableTrips([]));
    } else {
      setAvailableTrips([]);
    }
  }, [selectedRoute, selectedDate, activeTab]);

  const handleSearch = async () => {
    if (!selectedRoute || (activeTab === "trip" && !selectedTrip)) {
      alert(activeTab === "trip" ? t("alert_history_select_route_and_trip") : t("alert_history_select_route_only"));
      return; // Exit function early
    }
     // Reset UI state. Clear the map immediately, as well as the trip origin and the execution data.
    setHistoryData([]);
    setTripOrigin([]);
    setTripExecution([]);
    setStops([]);
    setLoading(true);
    try {
      // 1. Fetch main history data (GPS points for the map)
      const data = await fetchHistory({ 
        mode: activeTab,
        route_id: selectedRoute,
        trip_id: selectedTrip, 
        date: selectedDate,
        start_time: startTime, 
        end_time: endTime
      });
      setHistoryData(data);
      
      // 2. Fetch Trip Shape
      if (selectedTrip) {
        const shapeData = await fetchTripShape(selectedTrip, true);
        setShape(shapeData);

        let shapeDirection = 0;

        const tripIdShapePrefix = selectedTrip.split("|")[0];
        // First part of tripId is 205_0_1, 205_0_2, ... Last number is the direction + 1.
        // For circulars like 300_0_3, direction is 0 
        // If not found or unexpected format, default to 0
        const parsedDirection = parseInt(tripIdShapePrefix.split("_").at(-1) || "1");
        if ((parsedDirection == 1) || (parsedDirection == 2)) {
          shapeDirection = parsedDirection - 1; // Convert to zero-based index
        } else if (parsedDirection == 3) {
          shapeDirection = 0; // Set to 0 for direction 3
        } else {
          shapeDirection = 0; // Default if parsing fails or if direction is not in expected format
        }

        const stopsData = await fetchTripStops(selectedTrip, true);
        setStops(stopsData);

        const origin = await fetchTripOrigin(selectedTrip, true);
        setTripOrigin([origin]);

        const exec = await fetchTripExecution(selectedTrip, selectedDate);
        setTripExecution(exec);

      }

      // 3. Fetch Route Colors
      if (selectedRoute) {
        const selectedRouteColors = getRouteColors(selectedRoute, 0);
        setRouteColors({
          bgColor: selectedRouteColors.bgColor || 'transparent',
          textColor: selectedRouteColors.textColor || 'var--(text-main)'
        });
      }

    } catch (e) {
      console.error("Search error:", e);
      alert(t("alert_search_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Tab Switcher */}
      <div style={{ display: "flex", background: "var(--bg-sub-header)", borderBottom: "1px solid var(--border-color)" }}>
        <button 
          onClick={() => setActiveTab("trip")}
          style={tabStyle(activeTab === "trip")}
        >🔍 {t("history_trip_search")}</button>
        <button 
          onClick={() => setActiveTab("route")}
          style={tabStyle(activeTab === "route")}
        >🛤️ {t("history_route_search")}</button>
      </div>

      {/* Search Controls */}
      <div style={{ padding: "15px", display: "flex", gap: "10px", flexWrap: "wrap", 
        alignItems: "flex-end", background: "var(--bg-sub-header)", borderBottom: "1px solid var(--border-color)" }}>
        <div className="field">
          <label style={styles.label}>{t("gen_route")}</label>
          <select value={selectedRoute} onChange={(e) => {
            setSelectedRoute(e.target.value); 
            setSelectedTrip(""); // Reset the trip whenever the route changes
          }} style={styles.dropdown}>
            <option value="">{t("history_route_select")}</option>
            {allRoutes.map(r => <option key={r.route_id} value={r.route_id} style={styles.dropdownItem}>{r.route_short_name}</option>)}
          </select>
        </div>

        {activeTab === "trip" ? (
          <div className="field">
            <label style={styles.label}>{t("history_trip_id")}</label>
            <select value={selectedTrip} onChange={(e) => setSelectedTrip(e.target.value)} style={styles.input} disabled={availableTrips.length === 0}>
                <option value="" hidden={!!selectedTrip}>
                    {availableTrips.length > 0 ? t("history_trip_select") : t("history_trip_notripsfound")}
                </option>
                {availableTrips.map(tid => (
                    <option key={tid} value={tid} style={styles.dropdownItem}>{tid}</option>
                ))}
            </select>
          </div>
        ) : (
          <>
            <div className="field">
              <label style={styles.label}>{t("history_start_time")}</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={styles.input} />
            </div>
            <div className="field">
              <label style={styles.label}>{t("history_end_time")}</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={styles.input} />
            </div>
          </>
        )}

        <div className="field">
          <label style={styles.label}>{t("gen_date")}</label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={styles.input} />
        </div>

        <button onClick={handleSearch} disabled={loading} style={styles.button}>
          {loading ? t("gen_searching") : t("history_search_btn")}
        </button>
      </div>

      {/* Trip Header */}
      <div style={{ height: "75px", display: "flex", gap: "10px", flexWrap: "wrap", padding: "15px",
        alignItems: "flex-end", background: "var(--bg-sub-header)", borderBottom: "1px solid var(--border-color)"}}>
          {selectedRoute && (
            <>
              {historyData[0]?.route_short_name ? (
                <span style={{ backgroundColor: selectedRouteColors.bgColor, color: selectedRouteColors.textColor, padding: "2px 2px", borderRadius: 10, minWidth: 80,
                            display: "inline-block", textAlign: "center", fontSize: "32px"}}>
                            <b>{historyData[0]?.route_short_name || " "}</b> </span> 
                          ) : ( " " ) }

              {/* Table-like Container for the Headsign and Subtext */}
              {/* <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", margin: 0, padding: 0 }}> */}

                  {/* First Row: Trip Headsign */}
                {/* <span style={{ fontSize: "24px", lineHeight: "1", color: "var(--text-main)" }}>
                  <b>→&nbsp;{historyData[0]?.trip_headsign || " "}</b>
                </span> */}

                {/* Second Row: Placeholder Text */}
                {/* <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.2" }}>
                  Origin: {tripOrigin[0]?.origin_stop_name}
                </span> */}

              {/* </div> */}
              <span style={{ textAlign: "center", fontSize: "24px", paddingBottom: "8px" }}>
                {(historyData[0]?.trip_headsign && tripOrigin[0]?.origin_stop_name) ? (
                  <>
                    {tripOrigin[0]?.origin_stop_name}
                    <b>&nbsp;→&nbsp;{historyData[0]?.trip_headsign}</b>
                  </>
                ) : ( " " )} </span>
            </>
            )}
      </div>

      {/* Main Content Area: Side-by-Side Wrapper */}
      <div style={{ 
        display: "flex", 
        flexDirection: "row", // Horizontal layout
        flex: 1, 
        width: "100%", 
        overflow: "hidden", // Keeps the scroll within the children
        background: "var(--bg-main)"
      }}>

        {/* Left Column: Trip Spine */}
        {tripExecution.length > 0 && (
          <div style={{ 
            flex: "2",             // Takes 1 share of space
            minWidth: "320px",     // Prevents it from getting too squished
            maxWidth: "450px",     // Prevents it from getting too wide on huge monitors
            borderRight: "1px solid var(--border-color)", 
            overflowY: "auto",      // Only the spine scrolls
            background: "var(--bg-nav)"
          }}>
            <TripSpine 
              execution={tripExecution} 
              routeColors={selectedRouteColors} 
            />
          </div>
        )}

        {/* Right Column: Map Content */}
        <div style={{ 
          flex: "5",               // Takes 3 shares (Map will be ~75% width)
          position: "relative",
          height: "100%"
        }}>
          <HistoryMap 
            vehicles={historyData} 
            shapeData={shape} 
            selectedRoute={selectedRoute} 
            stops={stops}
          />
        </div>

      </div>

      <div style={{ minHeight: "60px"}}>&nbsp;</div>

    </div>
  );
}

// Simple Styles
const tabStyle = (active: boolean) => ({
  padding: "10px 20px",
  cursor: "pointer",
  border: "none",
  background: active ? "white" : "transparent",
  borderBottom: active ? "2px solid #0b5" : "2px solid transparent",
  fontWeight: active ? "bold" : "normal",
  color: active ? "#000000" : "#999999",
  transition: "all 0.2s ease",
});

const styles: Record<string, React.CSSProperties> = {

  button: {
    padding: "8px 16px", background: "var(--bg-button)", color: "var(--text-main)",
    border: "none", borderRadius: "4px", cursor: "pointer" },

  input: { 
    padding: "6px 8px", border: "1px solid var(--border-color)", borderRadius: 6, minWidth: 120,
    background: "var(--bg-input-select)", color: "var(--text-main)" },

  label: {
    display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" },
    
  select: { 
    position: "relative",  display: "flex", alignItems: "center",
    background: "var(--bg-input-select)", border: "1px solid var(--border-color)", borderRadius: 4,
    padding: "2px 4px", minHeight: 30, minWidth: 120, cursor: "text", color: "var(--text-main)" },

  dropdown: {
    position: "relative", padding: "6px 8px", 
    minHeight: 30, minWidth: 120, overflowY: "auto",
    color: "var(--text-main)", backgroundColor: "var(--bg-input-select)", 
    border: "1px solid var(--border-color)", borderRadius: 4 },

  dropdownItem: {
    padding: "8px 12px", cursor: "pointer",
    fontSize: 13, borderBottom: "1px solid var(--border-color)",
    color: "var(--text-main)", backgroundColor: "var(--bg-input-select)",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
};