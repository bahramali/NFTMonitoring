import React from 'react';
import styles from './SensorCard.module.css';

function SensorCard({ name, ok, children }) {
    const headerClass = `${styles.header} ${ok ? styles.on : styles.off}`;
    return (
        <div className={styles.card}>
            <div className={headerClass}>{name}: {ok ? 'On' : 'Off'}</div>
            <div className={styles.body}>{children}</div>
        </div>
    );
}

export default SensorCard;
