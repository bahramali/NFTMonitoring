import React from 'react';
import styles from './MetricCard.module.css';

export default function MetricCard({ title, value, unit }) {
    return (
        <div className={styles.card}>
            <div className={styles.title}>{title}</div>
            <div className={styles.value}>
                {value}
                {unit ? <span className={styles.unit}>{unit}</span> : null}
            </div>
        </div>
    );
}
