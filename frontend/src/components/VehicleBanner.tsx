import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { VehicleActivity } from "../api/client";
import { getRouteColors } from "../components/Map";

interface VehicleBannerProps {
    vehicle: VehicleActivity;
    selectedRoute: string;
}

export function VehicleBanner({ vehicle }: VehicleBannerProps) {
    
    const { t } = useLanguage();
        
    const [isOpen, setIsOpen] = useState(false);

    // Helper to determine fuel badge styling and icons based on fuel type
    const getFuelBadgeDetails = (fuel: string | null) => {
        const normalizedFuel = fuel?.toLowerCase() || "";
        
        switch (normalizedFuel) {
            case "electric":
                return {
                    bg: "#FFD700",
                    color: "#000000",
                    icon: "E",
                    // icon: "⚡",
                    label: t("fleet_propulsion_electric")
                };
            case "cng":
                return {
                    bg: "#8cc8d4",
                    color: "#000000",
                    icon: "G",
                    // icon: "⛽",
                    label: t("fleet_propulsion_CNG")
                };
            case "diesel":
                return {
                    bg: "#1C1C1E",
                    color: "#cccccc",
                    // icon: "⛽",
                    icon: "D",
                    label: t("fleet_propulsion_diesel")
                };
            case "hydrogen":
                return {
                    bg: "#007AFF",
                    color: "#FFFFFF",
                    icon: "H",
                    // icon: "💧",
                    label: t("fleet_propulsion_H2")
                };
            default:
                return {
                    bg: "var(--bg-input-select)",
                    color: "var(--text-main)",
                    icon: "?",
                    // icon: "🚌",
                    label: fuel || t("fleet_propulsion_unknown")
                };
        }
    };

    const fuelDetails = getFuelBadgeDetails(vehicle.vehicle_fuel);

    const formatPTTime = (dateString: string) => {
        if (!dateString) return "";
        return `${new Date(dateString).toLocaleTimeString('pt-PT', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'Europe/Lisbon' 
        })}`;
    };

    return (
        <div style={{
            flexShrink: 0,
            marginBottom: "12px",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            overflow: "hidden",
            display: "flex",
            background: "var(--banner-collapsed-bg)",
            flexDirection: "column",
            transition: "box-shadow 0.2s ease",
            color: "var(--text-main)" // Ensure text color is visible
        }} className="vehicle-row-container">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: "8px 10px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    userSelect: "none",
                    background: isOpen ? "var(--banner-collapsed-bg)" : "transparent",
                }}
            >
                <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                    <div style={{ 
                        background: "var(--link-color)", 
                        color: "var(--text-inverted)", 
                        padding: "4px 10px", 
                        borderRadius: "6px", 
                        fontWeight: "bold",
                        minWidth: "60px",
                        textAlign: "center"
                    }}>
                        {vehicle.vehicle_id}
                    </div>
                    
                    {/* Fuel Type Badge with customizable alt-text on hover */}
                    <div 
                        title={fuelDetails.label}
                        style={{ 
                            background: fuelDetails.bg,
                            color: fuelDetails.color,
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.85rem",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                        }}
                    >
                        <span>{fuelDetails.icon}</span>
                    </div>
                        
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        {vehicle.vehicle_type || " "}
                    </div>

                    {/* NEW: Route Badges for Collapsed View */}
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                        {vehicle.routes?.map((r: any) => {
                            const { bgColor, textColor } = getRouteColors(r.route_id, 0);
                            return (
                                <span 
                                    key={r.route_id}
                                    style={{
                                        background: bgColor || "var(--bg-input-select)",
                                        color: textColor || "inherit",
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        fontSize: "1rem",
                                        fontWeight: "bold",
                                        border: "1px solid var(--border-color)",
                                    }}
                                >
                                    {r.route_short_name}
                                </span>
                            );
                        })}
                    </div>
                </div>

                <div style={{ 
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", 
                    transition: "0.2s",
                    color: "var(--text-main)"
                }}>
                    ▼
                </div>
            </div>

            {isOpen && (
                <div style={{ 
                    padding: "20px", 
                    backgroundColor: "var(--banner-expanded-bg)",
                    borderTop: "1px solid var(--border-color)",
                }}>
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 7fr", gap: "20px" }}>
                        <section>
                            <h4 style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>{t("fleet_technical_specs").toUpperCase()}</h4>
                            <p style={{ margin: "4px 0" }}><span style={{ color: "var(--text-secondary)" }}>{t("fleet_type")}</span> {vehicle.vehicle_type || "N/A"}</p>
                            <p style={{ margin: "4px 0" }}><span style={{ color: "var(--text-secondary)" }}>{t("fleet_propulsion")}</span> {vehicle.vehicle_fuel || "N/A"}</p>
                            <p style={{ margin: "4px 0" }}><span style={{ color: "var(--text-secondary)" }}>{t("gen_year")}</span>: {vehicle.vehicle_chassis_year || "N/A"}</p>
                            <p style={{ margin: "4px 0" }}><span style={{ color: "var(--text-secondary)" }}>{t("fleet_license_plate")}</span> {vehicle.vehicle_license_plate || "N/A"}</p>
                            <p style={{ margin: "4px 0" }}><span style={{ color: "var(--text-secondary)" }}>{t("fleet_model")}</span> {vehicle.vehicle_model || "N/A"}</p>
                        </section>

                        <section>
                            <h4 style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>{t("fleet_todays_routes").toUpperCase()}</h4>
                            {/* arrivals.map((a, idx) => {
                                        const { bgColor, textColor } = getRouteColors(a.route_short_name, 0);
                                      return ( */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                                {vehicle.routes?.map((r: any) => {
                                    // 1. Calculate colors inside the map block
                                    const { bgColor, textColor } = getRouteColors(r.route_id, 0);

                                    return (
                                        <div key={r.route_id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            {/* Route ID Badge */}
                                            <span 
                                                title={r.route_long_name} 
                                                style={{
                                                    display: "inline-block", whiteSpace: "nowrap", // these ensure that the badge is adapted to route_short_name's size
                                                    background: bgColor || "var(--bg-input-select)",
                                                    color: textColor || "inherit",
                                                    padding: "3px 8px", borderRadius: "4px",
                                                    fontSize: "16px", fontWeight: "bold",
                                                    border: "1px solid var(--border-color)",
                                                    textAlign: "center"
                                                }}
                                            >
                                                {r.route_short_name}
                                            </span>

                                            {/* Route Name Label */}
                                            <span style={{ 
                                                fontSize: "16px", 
                                                color: "var(--text-main)", 
                                                whiteSpace: "nowrap" 
                                            }}>
                                                {r.route_long_name}
                                            </span>
                                            &nbsp;
                                            {/* First and last observation at route */}
                                            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                                                {t("gen_time_from")} <b>{formatPTTime(r.route_first_observed)}</b> {t("gen_time_until")} <b>{formatPTTime(r.route_last_observed)}</b>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
}