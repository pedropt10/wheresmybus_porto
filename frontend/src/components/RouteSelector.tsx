import React, { useState, useMemo } from "react";
import { getRouteColors } from "./Map";
import { AllRoutes } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

type Props = {
  selectedRoute: string;
  onRouteChange: (selectedRoute: string) => void;
  allRoutes: AllRoutes[];
};

export function RouteSelector({
  selectedRoute,
  onRouteChange,
  allRoutes
}: Props) {
  const { t } = useLanguage();

  const [searchTerm, setSearchTerm] = useState("");
  const [isListOpen, setIsListOpen] = useState(false);
  
  const selectedRouteObj = useMemo(() => 
      allRoutes.find(r => r.route_id === selectedRoute), 
    [selectedRoute, allRoutes]);

  // Filter routes based on what the user is typing
  const filteredRoutes = useMemo(() => {
    if (!searchTerm) return allRoutes;
    return allRoutes.filter(r => 
      r.route_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.route_short_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, allRoutes]);

  // Get colors for the currently selectedRoute (or defaults if none)
  const { bgColor, textColor } = useMemo(() => {
      if (!selectedRouteObj) return { bgColor: 'transparent', textColor: 'inherit' };
      return getRouteColors(selectedRouteObj.route_id, 0);
    }, [selectedRouteObj]);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <div style={{ ...styles.select, minWidth: 120, cursor: "text"
            }} 
        onClick={() => setIsListOpen(true)}>
        
        {/* SELECTED ROUTE BOX (Visible when list is closed and selectedRoute is selected) */}
        {!isListOpen && selectedRouteObj && (
            <span style={{ 
            backgroundColor: bgColor, color: textColor, padding: "2px 6px", 
            borderRadius: 4, fontSize: 14, fontWeight: "bold", marginRight: 4                
            }}>
            {selectedRouteObj.route_short_name}
            </span>
        )}

        {/* SEARCH INPUT */}
        <input
            value={isListOpen ? searchTerm : (selectedRouteObj ? "" : selectedRoute)}
            onFocus={() => {
            setIsListOpen(true);
            setSearchTerm("");
            }}
            onBlur={() => setTimeout(() => setIsListOpen(false), 200)}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={!selectedRouteObj ? "..." : ""}
            style={{ 
                border: "none", outline: "none", 
                width: isListOpen ? "100%" : 60, // Shrink when showing the "pill"
                height: 24, fontSize: 13, background: "var(--bg-input-select)"
            }} 
        />
        </div>

        {isListOpen && (
        <div style={styles.dropdown}>
            <div 
            onMouseDown={() => {
                onRouteChange(""); // Set selectedRoute to empty string for "All"
                setIsListOpen(false);
                setSearchTerm("");
            }}
            style={{ ...styles.dropdownItem, fontWeight: 'regular', color: '#555' }}
            >{t("selector_allroutes")}</div>
            {filteredRoutes.map((r) => {
            const { bgColor, textColor } = getRouteColors(r.route_id, 0);
            return (
                <div 
                    key={r.route_id}
                    onMouseDown={() => { // Use onMouseDown to trigger before onBlur
                        onRouteChange(r.route_id);
                        setIsListOpen(false);
                        setSearchTerm("");
                }}
                style={styles.dropdownItem}
                >
                <span style={{ 
                    backgroundColor: bgColor, color: textColor, 
                    padding: "2px 6px", borderRadius: 4, minWidth: 20,
                    display: "inline-block", textAlign: "center"
                }}>
                    <b>{r.route_short_name}</b>
                </span>
                &nbsp; {r.route_long_name}
                </div>
            );
            })}
        </div>
        )}
    </div>

  );
}

const styles: Record<string, React.CSSProperties> = {

  input: { 
    padding: "6px 8px", border: "1px solid var(--border-color)", borderRadius: 6, width: 100, 
    background: "var(--bg-input-select)", color: "var(--text-main)" },
    
  select: { 
    position: "relative",  display: "flex", alignItems: "center",
    background: "var(--bg-input-select)", border: "1px solid var(--border-color)", borderRadius: 4,
    padding: "2px 4px", minHeight: 30, minWidth: 120, cursor: "text", color: "var(--text-main)" },

  dropdown: {
    position: "absolute", top: "100%", 
    width: 300, maxHeight: 300, overflowY: "auto",
    backgroundColor: "var(--bg-nav)", border: "1px solid var(--border-color)", borderRadius: 4,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 2000, marginTop: 4 },

  dropdownItem: {
    padding: "8px 12px", cursor: "pointer",
    fontSize: 13, borderBottom: "1px solid var(--border-color)",
    color: "var(--text-main)", backgroundColor: "var(--bg-sub-header)",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
};