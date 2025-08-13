import React from 'react';
import MetricCard from './MetricCard';
import styles from './LayerMetrics.module.css';

export default function LayerMetrics({ metrics = {} }) {
    return (
        <div className={styles.grid}>
            {Object.entries(metrics).map(([key, val]) => (
                <MetricCard key={key} title={key} value={val} />
            ))}
        </div>
    );
}
