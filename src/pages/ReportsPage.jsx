import React from 'react';

import Header from '../components/Header';
import ReportsUX from '../components/reports/ReportsUX';
import styles from '../components/SensorDashboard.module.css';

function ReportsPage() {
  const handleRun = (filters) => {
    // Placeholder for data fetching logic
    console.log('Run report', filters);
  };

  const handleExport = (filters) => {
    console.log('Export report', filters);
  };

  return (
    <div className={styles.dashboard}>
      <Header title="Reports" />
      <div className={styles.section}>
        <div className={styles.sectionBody}>
          <ReportsUX onRun={handleRun} onExport={handleExport} />
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
