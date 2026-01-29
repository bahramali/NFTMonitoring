import React from "react";
import { useParams } from "react-router-dom";
import Header from "../common/Header";
import LiveSensorsPanel from "./components/LiveSensorsPanel.jsx";
import HistoricalTrendsPanel from "./components/HistoricalTrendsPanel.jsx";
import styles from "../Germination/Germination.module.css";

export default function RackDashboardPage() {
    const { rackId } = useParams();
    const normalizedRackId = String(rackId ?? "").trim();
    const title = normalizedRackId ? `Rack ${normalizedRackId}` : "Rack Dashboard";

    return (
        <div className={styles.page}>
            <Header title={title} />
            <LiveSensorsPanel rackId={normalizedRackId} />
            <HistoricalTrendsPanel rackId={normalizedRackId} />
        </div>
    );
}
