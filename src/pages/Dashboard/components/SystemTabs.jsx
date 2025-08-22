import React from 'react';
import styles from '../../common/SensorDashboard.module.css';

function SystemTabs({systems = [], activeSystem, onChange}) {
    return (
        <div className={styles.tabBar}>
            {systems.map((system) => (
                <button
                    key={system}
                    className={`${styles.tab} ${activeSystem === system ? styles.activeTab : ''}`}
                    onClick={() => onChange(system)}
                >
                    {system}
                </button>
            ))}
        </div>
    );
}

export default SystemTabs;
