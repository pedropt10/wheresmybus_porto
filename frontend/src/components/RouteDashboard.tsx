// import { fetchShapeSpine, type ShapeSpine } from "../api/client";
// import React, { useState, useMemo } from "react";

// import { useLanguage } from "../context/LanguageContext";


// interface ShapeSpineProps {
//     shapeSpineData: ShapeSpine;
//     selectedRoute: string;
//     selectedRouteColors: { bgColor: string; textColor: string };
// }

// export function RouteDashboard({ shapeSpineData, selectedRoute, selectedRouteColors }: ShapeSpineProps) {
    
//     const { t } = useLanguage();

// }

import React, { useMemo } from "react";
import { type ShapeSpine, type StopPoint } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

interface RouteDashboardProps {
    outboundSpine?: ShapeSpine | null; // Direction 0
    inboundSpine?: ShapeSpine | null;  // Direction 1
    selectedRoute: string;
    selectedRouteColors: { bgColor: string; textColor: string };
}

export function RouteDashboard({ 
    outboundSpine, 
    inboundSpine, 
    selectedRoute, 
    selectedRouteColors 
}: RouteDashboardProps) {
    
    const { t } = useLanguage();

    // Reverse the inbound stops list so it reads bottom-to-top chronologically
    const mirroredInboundStops = useMemo(() => {
        if (!inboundSpine?.stops) return [];
        return [...inboundSpine.stops].reverse();
    }, [inboundSpine]);

    const renderSpineColumn = (
        stops: StopPoint[], 
        direction: 0 | 1, 
        isReversedList: boolean
    ) => {
        return (
            <div style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                width: "280px",
                padding: "20px 0"
            }}>
                {/* Vertical Central Backbone Track Line */}
                <div style={{
                    position: "absolute",
                    top: "30px",
                    bottom: "30px",
                    width: "4px",
                    backgroundColor: selectedRouteColors.bgColor || "var(--border-color)",
                    left: direction === 0 ? "auto" : "12px",   // Left spine tracks right edge
                    right: direction === 0 ? "12px" : "auto",  // Right spine tracks left edge
                    borderRadius: "2px",
                    zIndex: 1
                }} />

                {stops.map((stop, idx) => {
                    // Determine terminal nodes using logical chronological index rules
                    const isFirst = isReversedList ? idx === stops.length - 1 : idx === 0;
                    const isLast = isReversedList ? idx === 0 : idx === stops.length - 1;
                    const isTerminal = isFirst || isLast;

                    return (
                        <div 
                            key={`${stop.stop_id}-${idx}`}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: direction === 0 ? "flex-end" : "flex-start",
                                gap: "16px",
                                position: "relative",
                                zIndex: 2,
                                textAlign: direction === 0 ? "right" : "left",
                                flexDirection: direction === 0 ? "row" : "row-reverse"
                            }}
                        >
                            {/* Stop Label Node Text */}
                            <span style={{
                                fontSize: isTerminal ? "14px" : "12px",
                                fontWeight: isTerminal ? "bold" : "500",
                                color: isTerminal ? "var(--text-main)" : "var(--text-tertiary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "220px"
                            }}>
                                {stop.stop_name}
                            </span>

                            {/* Node Bullet Dot Indicator */}
                            <div style={{
                                width: isTerminal ? "14px" : "10px",
                                height: isTerminal ? "14px" : "10px",
                                borderRadius: "50%",
                                backgroundColor: isTerminal ? "var(--bg-main)" : "var(--bg-input-select)",
                                border: `3px solid ${isTerminal ? selectedRouteColors.bgColor : "var(--border-color)"}`,
                                boxShadow: isTerminal ? "0 0 6px rgba(0,0,0,0.2)" : "none",
                                flexShrink: 0
                            }} />
                        </div>
                    );
                })}
            </div>
        );
    };

    if (!outboundSpine && !inboundSpine) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
                {t("route_dashboard_no_data")}
            </div>
        );
    }

    return (
        <div style={{
            display: "flex",
            justifyContent: "center",
            background: "var(--bg-main)",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid var(--border-color)",
            overflowX: "auto",
            margin: "10px"
        }}>
            <div style={{ display: "flex", gap: "80px", position: "relative" }}>
                
                {/* Outbound Spine Column (Direction 0) */}
                {outboundSpine?.stops && renderSpineColumn(outboundSpine.stops, 0, false)}

                {/* Inbound Spine Column (Direction 1) */}
                {inboundSpine?.stops && renderSpineColumn(mirroredInboundStops, 1, true)}
                
            </div>
        </div>
    );
}