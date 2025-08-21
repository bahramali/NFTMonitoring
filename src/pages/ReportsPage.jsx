import React from 'react';

import Header from '../components/Header';
import ReportsUX from '../components/reports/ReportsUX';
import styles from '../components/SensorDashboard.module.css';

function ReportsPage() {
  return (
    <div className={styles.dashboard}>
      <Header title="Reports" />
      <div className={styles.section}>
        <div className={styles.sectionBody}>
          <ReportsUX />
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
