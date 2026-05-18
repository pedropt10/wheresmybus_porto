import React, { useMemo } from "react";
import { type RouteSnapshot, type ShapeSpine, type StopPoint } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

const PIXELS_PER_STOP = 45; 
const MIN_HEIGHT = 400;

interface RouteDashboardProps {
    outboundSpine?: ShapeSpine | null; // Direction 0
    inboundSpine?: ShapeSpine | null;  // Direction 1
    selectedRoute: string;
    selectedRouteColors: { bgColor: string; textColor: string };
    routeSnapshot?: RouteSnapshot[] | null;
    height?: string;            // Total vertical track height (e.g., "600px")
}

interface SpineColumnProps {
    stops: StopPoint[];
    direction: 0 | 1;
    dynamicHeight: string;
    selectedRouteColors: { bgColor: string; textColor: string };
    routeSnapshot?: RouteSnapshot[] | null;
}

// REACT COMPONENT
function SpineColumn({
    stops,
    direction,
    dynamicHeight,
    selectedRouteColors,
    routeSnapshot
}: SpineColumnProps) {
    // Hooks are safe here because this component renders deterministically
    const vehiclesOnTrack = useMemo(() => {
        if (!routeSnapshot) return [];
        
        return routeSnapshot
            .filter(vehicle => vehicle.direction === direction)
            .map(vehicle => {
                const targetStopId = vehicle.cur_stop_id || vehicle.last_stop_id;
                const matchedStop = stops.find(s => s.stop_id === targetStopId);
                
                if (!matchedStop) return null;

                const verticalTopPosition = direction === 0 
                    ? matchedStop.distance_percentage 
                    : 100 - matchedStop.distance_percentage;

                return {
                    ...vehicle,
                    verticalTopPosition,
                    stopName: matchedStop.stop_name
                };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);
    }, [routeSnapshot, stops, direction]);

    return (
        <div style={{
            position: "relative",
            width: "280px",
            padding: "0",
            height: dynamicHeight,
        }}>
            {/* Vertical Central Backbone Track Line */}
            <div style={{
                position: "absolute",
                top: "0",
                bottom: "0",
                width: "10px",
                backgroundColor: selectedRouteColors.bgColor || "var(--border-color)",
                left: direction === 0 ? "auto" : "100px",   // Left spine tracks right edge
                right: direction === 0 ? "100px" : "auto",  // Right spine tracks left edge
                borderRadius: "2px",
                zIndex: 1
            }} />

            {/* --- Vehicles Overlay Layer --- */}
            {vehiclesOnTrack.map((vehicle) => (
                <div
                    key={vehicle.vehicle_id}
                    title={`🚌 ${vehicle.vehicle_id} → ${vehicle.trip_headsign}`}
                    style={{
                        position: "absolute",
                        top: `${vehicle.verticalTopPosition}%`,
                        // Anchor coordinates perfectly over the center of the 10px track line
                        left: direction === 0 ? "auto" : "105px",
                        right: direction === 0 ? "105px" : "auto",
                        transform: "translate(-50%, -50%)",
                        zIndex: 3, // Sit above both the track line and stop node elements
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "24px",
                        height: "24px",
                        backgroundColor: "var(--bg-main)",
                        border: `2px solid ${selectedRouteColors.bgColor}`,
                        borderRadius: "50%",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        fontSize: "12px",
                        cursor: "pointer",
                        transition: "top 0.5s ease-in-out" // Softens live refresh rendering bumps
                    }}
                >
                    🚌
                </div>
            ))}

            {/* --- Static Stop Nodes Layer --- */}
            {stops.map((stop, idx) => {
                // Check if it is a terminal stop chronologically based on distance
                const isFirst = stop.distance_percentage === 0;
                const isLast = stop.distance_percentage === 100 || idx === stops.length - 1;
                const isTerminal = isFirst || isLast;

                // Calculate variable placement based on distance scale
                // Direction 0 maps 0% to Top | Direction 1 maps 0% to Bottom (100 - pct)
                const verticalTopPosition = direction === 0 
                    ? stop.distance_percentage 
                    : 100 - stop.distance_percentage;

                return (
                    <div 
                        key={`${stop.stop_id}-${idx}`}
                        style={{
                            position: "absolute",
                            top: `${verticalTopPosition}%`,
                            // Centering transform offsets the item height perfectly on its coordinate point
                            transform: "translateY(-50%)", 
                            left: direction === 0 ? "0" : "0",
                            right: direction === 0 ? "0" : "0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: direction === 0 ? "flex-end" : "flex-start",
                            gap: isTerminal ? "8px" : "12px",
                            zIndex: 2,
                            textAlign: direction === 0 ? "right" : "left"
                            // flexDirection: direction === 0 ? "row" : "row-reverse"
                        }}
                    >
                        {/* ONLY FOR RIGHT-HAND SIDE SPINE, Stops aligned on the left
                        Node Bullet Dot Indicator*/}
                        {direction !== 0 && (
                            <div style={{
                                width: isTerminal ? "20px" : "6px",
                                height: isTerminal ? "20px" : "6px",
                                borderRadius: "50%",
                                backgroundColor: selectedRouteColors.textColor,
                                border: `${isTerminal ? "5px" : "0px"} solid ${selectedRouteColors.bgColor}`,
                                marginLeft: `${isTerminal ? "95px" : "102px"}`,
                                flexShrink: 0
                            }} />
                        )}

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
                            {(direction !== 0 && !isTerminal) && ("↓")} {stop.stop_name} {(direction !== 1 && !isTerminal) && ("↑")}
                        </span>

                        {/* ONLY FOR LEFT-HAND SIDE SPINE, Stops aligned on the right
                        Node Bullet Dot Indicator*/}
                        {direction !== 1 && (
                            <div style={{
                                width: isTerminal ? "20px" : "6px",
                                height: isTerminal ? "20px" : "6px",
                                borderRadius: "50%",
                                backgroundColor: selectedRouteColors.textColor,
                                border: `${isTerminal ? "5px" : "0px"} solid ${selectedRouteColors.bgColor}`,
                                marginRight: `${isTerminal ? "95px" : "102px"}`,
                                flexShrink: 0
                            }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// MAIN COMPONENT CONTAINER
export function RouteDashboard({ 
    outboundSpine, 
    inboundSpine, 
    selectedRoute, 
    selectedRouteColors,
    routeSnapshot,
}: RouteDashboardProps) {
    
    const { t } = useLanguage();

    // Calculate the dynamic height based on the dense direction
    const dynamicHeight = useMemo(() => {
        const outboundCount = outboundSpine?.stops?.length || 0;
        const inboundCount = inboundSpine?.stops?.length || 0;
        const maxStops = Math.max(outboundCount, inboundCount);
        
        const calculatedPixels = maxStops * PIXELS_PER_STOP;
        return `${Math.max(calculatedPixels, MIN_HEIGHT)}px`;
    }, [outboundSpine, inboundSpine]);

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
            padding: "40px 40px 0px 0px", 
            overflow: "auto",                    
            maxHeight: "calc(100vh - 120px)",     
            margin: "10px"
        }}>
            <div style={{ display: "flex", gap: "80px", position: "relative" }}>
                
                {/* Outbound Spine Column (Direction 0: Top to Bottom) */}
                {outboundSpine?.stops && (
                    <SpineColumn 
                        stops={outboundSpine.stops}
                        direction={0}
                        dynamicHeight={dynamicHeight}
                        selectedRouteColors={selectedRouteColors}
                        routeSnapshot={routeSnapshot}
                    />
                )}

                {/* Inbound Spine Column (Direction 1: Bottom to Top) */}
                {inboundSpine?.stops && (
                    <SpineColumn 
                        stops={inboundSpine.stops}
                        direction={1}
                        dynamicHeight={dynamicHeight}
                        selectedRouteColors={selectedRouteColors}
                        routeSnapshot={routeSnapshot}
                    />
                )}

            </div>
        </div>
    );
}


// import React, { useMemo } from "react";
// import { type RouteSnapshot, type ShapeSpine, type StopPoint } from "../api/client";
// import { useLanguage } from "../context/LanguageContext";

// const PIXELS_PER_STOP = 45; 
// const MIN_HEIGHT = 400;

// interface RouteDashboardProps {
//     outboundSpine?: ShapeSpine | null; // Direction 0
//     inboundSpine?: ShapeSpine | null;  // Direction 1
//     selectedRoute: string;
//     selectedRouteColors: { bgColor: string; textColor: string };
//     routeSnapshot?: RouteSnapshot[] | null;
//     height?: string;            // Total vertical track height (e.g., "600px")
// }

// export function RouteDashboard({ 
//     outboundSpine, 
//     inboundSpine, 
//     selectedRoute, 
//     selectedRouteColors,
//     routeSnapshot,
// }: RouteDashboardProps) {
    
//     const { t } = useLanguage();

//     // Calculate the dynamic height based on the dense direction
//     const dynamicHeight = useMemo(() => {
//         const outboundCount = outboundSpine?.stops?.length || 0;
//         const inboundCount = inboundSpine?.stops?.length || 0;
//         const maxStops = Math.max(outboundCount, inboundCount);
        
//         // Calculate total pixels and ensure it doesn't fall below our minimum floor
//         const calculatedPixels = maxStops * PIXELS_PER_STOP;
//         return `${Math.max(calculatedPixels, MIN_HEIGHT)}px`;
//     }, [outboundSpine, inboundSpine]);

//     const renderSpineColumn = (
//         stops: StopPoint[], 
//         direction: 0 | 1
//     ) => {
//         // Filter live vehicles for this specific direction and resolve their track positions
//         const vehiclesOnTrack = useMemo(() => {
//             if (!routeSnapshot) return [];
            
//             return routeSnapshot
//                 .filter(vehicle => vehicle.direction === direction)
//                 .map(vehicle => {
//                     // Match vehicle against current stop or last stop fallback
//                     const targetStopId = vehicle.cur_stop_id || vehicle.last_stop_id;
//                     const matchedStop = stops.find(s => s.stop_id === targetStopId);
                    
//                     if (!matchedStop) return null;

//                     // Calculate variable placement matching the track direction rules
//                     const verticalTopPosition = direction === 0 
//                         ? matchedStop.distance_percentage 
//                         : 100 - matchedStop.distance_percentage;

//                     return {
//                         ...vehicle,
//                         verticalTopPosition,
//                         stopName: matchedStop.stop_name
//                     };
//                 })
//                 .filter((v): v is NonNullable<typeof v> => v !== null);
//         }, [routeSnapshot, stops, direction]);

//         return (
//             <div style={{
//                 position: "relative",
//                 width: "280px",
//                 padding: "0",
//                 height: dynamicHeight,
//             }}>
//                 {/* Vertical Central Backbone Track Line */}
//                 <div style={{
//                     position: "absolute",
//                     top: "0",
//                     bottom: "0",
//                     width: "10px",
//                     backgroundColor: selectedRouteColors.bgColor || "var(--border-color)",
//                     left: direction === 0 ? "auto" : "100px",   // Left spine tracks right edge
//                     right: direction === 0 ? "100px" : "auto",  // Right spine tracks left edge
//                     borderRadius: "2px",
//                     zIndex: 1
//                 }} />

//                 {/* --- Vehicles Overlay Layer --- */}
//                 {vehiclesOnTrack.map((vehicle) => (
//                     <div
//                         key={vehicle.vehicle_id}
//                         title={`🚌 ${vehicle.vehicle_id} → ${vehicle.trip_headsign}`}
//                         style={{
//                             position: "absolute",
//                             top: `${vehicle.verticalTopPosition}%`,
//                             // Anchor coordinates perfectly over the center of the 10px track line
//                             left: direction === 0 ? "auto" : "105px",
//                             right: direction === 0 ? "105px" : "auto",
//                             transform: "translate(-50%, -50%)",
//                             zIndex: 3, // Sit above both the track line and stop node elements
//                             display: "flex",
//                             alignItems: "center",
//                             justifyContent: "center",
//                             width: "24px",
//                             height: "24px",
//                             backgroundColor: "var(--bg-main)",
//                             border: `2px solid ${selectedRouteColors.bgColor}`,
//                             borderRadius: "50%",
//                             boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
//                             fontSize: "12px",
//                             cursor: "pointer",
//                             transition: "top 0.5s ease-in-out" // Softens live refresh rendering bumps
//                         }}
//                     >
//                         🚌
//                     </div>
//                 ))}

//                 {/* --- Static Stop Nodes Layer --- */}
//                 {stops.map((stop, idx) => {
//                     // Check if it is a terminal stop chronologically based on distance
//                     const isFirst = stop.distance_percentage === 0;
//                     const isLast = stop.distance_percentage === 100 || idx === stops.length - 1;
//                     const isTerminal = isFirst || isLast;

//                     // Calculate variable placement based on distance scale
//                     // Direction 0 maps 0% to Top | Direction 1 maps 0% to Bottom (100 - pct)
//                     const verticalTopPosition = direction === 0 
//                         ? stop.distance_percentage 
//                         : 100 - stop.distance_percentage;

//                     return (
//                         <div 
//                             key={`${stop.stop_id}-${idx}`}
//                             style={{
//                                 position: "absolute",
//                                 top: `${verticalTopPosition}%`,
//                                 // Centering transform offsets the item height perfectly on its coordinate point
//                                 transform: "translateY(-50%)", 
//                                 left: direction === 0 ? "0" : "0",
//                                 right: direction === 0 ? "0" : "0",
//                                 display: "flex",
//                                 alignItems: "center",
//                                 justifyContent: direction === 0 ? "flex-end" : "flex-start",
//                                 gap: isTerminal ? "8px" : "12px",
//                                 zIndex: 2,
//                                 textAlign: direction === 0 ? "right" : "left"
//                                 // flexDirection: direction === 0 ? "row" : "row-reverse"
//                             }}
//                         >
//                             {/* ONLY FOR RIGHT-HAND SIDE SPINE, Stops aligned on the left
//                             Node Bullet Dot Indicator*/}
//                             {direction !== 0 && (
//                                 <div style={{
//                                     width: isTerminal ? "20px" : "6px",
//                                     height: isTerminal ? "20px" : "6px",
//                                     borderRadius: "50%",
//                                     backgroundColor: selectedRouteColors.textColor,
//                                     border: `${isTerminal ? "5px" : "0px"} solid ${selectedRouteColors.bgColor}`,
//                                     marginLeft: `${isTerminal ? "95px" : "102px"}`,
//                                     flexShrink: 0
//                                 }} />
//                             )}

//                             {/* Stop Label Node Text */}
//                             <span style={{
//                                 fontSize: isTerminal ? "14px" : "12px",
//                                 fontWeight: isTerminal ? "bold" : "500",
//                                 color: isTerminal ? "var(--text-main)" : "var(--text-tertiary)",
//                                 whiteSpace: "nowrap",
//                                 overflow: "hidden",
//                                 textOverflow: "ellipsis",
//                                 maxWidth: "220px"
//                             }}>
//                                 {(direction !== 0 && !isTerminal) && ("↓")} {stop.stop_name} {(direction !== 1 && !isTerminal) && ("↑")}
//                             </span>

//                             {/* ONLY FOR LEFT-HAND SIDE SPINE, Stops aligned on the right
//                             Node Bullet Dot Indicator*/}
//                             {direction !== 1 && (
//                                 <div style={{
//                                     width: isTerminal ? "20px" : "6px",
//                                     height: isTerminal ? "20px" : "6px",
//                                     borderRadius: "50%",
//                                     backgroundColor: selectedRouteColors.textColor,
//                                     border: `${isTerminal ? "5px" : "0px"} solid ${selectedRouteColors.bgColor}`,
//                                     marginRight: `${isTerminal ? "95px" : "102px"}`,
//                                     flexShrink: 0
//                                 }} />
//                             )}
//                         </div>
//                     );
//                 })}
//             </div>
//         );
//     };

//     if (!outboundSpine && !inboundSpine) {
//         return (
//             <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
//                 {t("route_dashboard_no_data")}
//             </div>
//         );
//     }

//     return (
//         <div style={{
//             display: "flex",
//             justifyContent: "center",
//             background: "var(--bg-main)",
//             padding: "40px 40px 0px 0px", // Padding top/bottom acts as safe zones for absolute items at 0% or 100%
//             overflow: "auto",                     // Captures both vertical and horizontal scroll
//             maxHeight: "calc(100vh - 120px)",     // Adjust this offset value to fit your layout header/footer
//             margin: "10px"
//         }}>
//             <div style={{ display: "flex", gap: "80px", position: "relative" }}>
                
//                 {/* Outbound Spine Column (Direction 0: Top to Bottom) */}
//                 {outboundSpine?.stops && renderSpineColumn(outboundSpine.stops, 0)}

//                 {/* Inbound Spine Column (Direction 1: Bottom to Top) */}
//                 {inboundSpine?.stops && renderSpineColumn(inboundSpine.stops, 1)}

//             </div>
//         </div>
//     );
// }