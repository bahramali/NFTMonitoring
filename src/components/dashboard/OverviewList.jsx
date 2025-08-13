import React from 'react';
import MetricCard from './MetricCard';
import styles from './OverviewList.module.css';

export default function OverviewList({ systems = [] }) {
    return (
        <div className={styles.grid}>
            {systems.map((sys) => (
                <div key={sys.id} className={styles.card}>
                    <h3 className={styles.title}>{sys.name}</h3>
                    <div className={styles.metrics}>
                        {sys.metrics &&
                            Object.entries(sys.metrics).map(([key, val]) => (
                                <MetricCard key={key} title={key} value={val} />
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
