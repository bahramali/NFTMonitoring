import React from 'react';
import MetricCard from './MetricCard';
import styles from './DeviceCard.module.css';

export default function DeviceCard({ name, metrics = {} }) {
    return (
        <div className={styles.card}>
            <h4 className={styles.title}>{name}</h4>
            <div className={styles.metrics}>
                {Object.entries(metrics).map(([key, val]) => (
                    <MetricCard key={key} title={key} value={val} />
                ))}
            </div>
        </div>
    );
}
