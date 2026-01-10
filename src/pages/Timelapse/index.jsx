import React from "react";
import TimelapseGallery from "../../components/TimelapseGallery.jsx";
import styles from "./TimelapsePage.module.css";

export default function TimelapsePage() {
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>Timelapse</h1>
                <p>Browse the latest greenhouse timelapse clips.</p>
            </header>
            <TimelapseGallery />
        </div>
    );
}
