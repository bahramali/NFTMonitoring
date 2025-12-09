import React from 'react';
import styles from './WorkerDashboard.module.css';

export default function WorkerDashboard() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1>Worker Dashboard</h1>
                <p>Workers can always reach Home and this dashboard. Other URLs redirect to allowed pages.</p>
                <ul className={styles.list}>
                    <li>Link to process orders.</li>
                    <li>Check assigned tasks.</li>
                    <li>Return to Home to view products.</li>
                </ul>
            </div>
        </div>
    );
}
