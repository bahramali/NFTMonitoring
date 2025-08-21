import React, { useState } from 'react';

import Header from '../components/Header';
import ReportsUX from '../components/reports/ReportsUX';
import ComparePanel from '../components/reports/ComparePanel';
import Tabs from '../components/reports/Tabs';
import styles from '../components/SensorDashboard.module.css';

function ReportsPage() {
  const [compareList, setCompareList] = useState([]);
  const [reportData, setReportData] = useState([]);

  const handleRun = (filters) => {
    // Placeholder for data fetching logic
    console.log('Run report', filters);
    setReportData([
      { time: '2024-01-01', value: 10 },
      { time: '2024-01-02', value: 15 },
    ]);
  };

  const addToCompare = (filters) => {
    setCompareList((prev) => [...prev, filters]);
  };

  const handleExport = () => {
    if (typeof document === 'undefined') return;
    const rows = Array.from(document.querySelectorAll('table tr'));
    if (!rows.length) return;
    const csv = rows
      .map((row) =>
        Array.from(row.querySelectorAll('th,td'))
          .map((cell) => `"${cell.textContent.replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearCompare = () => setCompareList([]);

  return (
    <div className={styles.dashboard}>
      <Header title="Reports" />
      <div className={styles.section}>
        <div className={styles.sectionBody}>
          <ReportsUX onRun={handleRun} onExport={handleExport} onAddToCompare={addToCompare} />
          <ComparePanel items={compareList} onClear={clearCompare} />
          <Tabs data={reportData} />
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
