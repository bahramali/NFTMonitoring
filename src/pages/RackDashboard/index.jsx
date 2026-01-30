import React from "react";
import { useParams } from "react-router-dom";
import Header from "../common/Header";
import RackDashboardView from "./RackDashboardView.jsx";
import styles from "../Germination/Germination.module.css";

export default function RackDashboardPage() {
    const { rackId } = useParams();
    const normalizedRackId = String(rackId ?? "").trim();
    const title = normalizedRackId ? `Rack ${normalizedRackId}` : "Rack Dashboard";

    return (
        <div className={styles.page}>
            <Header title={title} />
            <RackDashboardView rackId={normalizedRackId} />
        </div>
    );
}
