import React from 'react';
import styles from '../SensorDashboard.module.css';

function VerticalTabs({activeTab, onChange}) {
    return (
        <div className={styles.verticalTabBar}>
            <button
                className={`${styles.verticalTab} ${activeTab === 'live' ? styles.activeVerticalTab : ''}`}
                onClick={() => onChange('live')}
            >
                Live
            </button>
            <button
                className={`${styles.verticalTab} ${activeTab === 'report' ? styles.activeVerticalTab : ''}`}
                onClick={() => onChange('report')}
            >
                Report
            </button>
        </div>
    );
}

export default VerticalTabs;
