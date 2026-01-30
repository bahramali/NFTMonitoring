import React from "react";
import LiveSensorsPanel from "./components/LiveSensorsPanel.jsx";
import As7343TrendsPanel from "./components/As7343TrendsPanel.jsx";
import HistoricalTrendsPanel from "./components/HistoricalTrendsPanel.jsx";

export default function RackDashboardView({ rackId }) {
    const normalizedRackId = String(rackId ?? "").trim();
    const isGerminationRack = normalizedRackId.toLowerCase().includes("germination");

    return (
        <>
            <LiveSensorsPanel rackId={normalizedRackId} />
            {!isGerminationRack && <As7343TrendsPanel rackId={normalizedRackId} />}
            <HistoricalTrendsPanel rackId={normalizedRackId} />
        </>
    );
}
