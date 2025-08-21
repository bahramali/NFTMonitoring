import React, { useCallback, useEffect, useRef, useState } from 'react';

import Header from '../components/Header';
import ReportsUX from '../components/reports/ReportsUX';
import ComparePanel from '../components/reports/ComparePanel';
import Tabs from '../components/reports/Tabs';
import styles from '../components/SensorDashboard.module.css';

function ReportsPage() {
  const [compareList, setCompareList] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60000);
  const [bucket, setBucket] = useState('1m');
  const [activeFilters, setActiveFilters] = useState(null);
  const intervalRef = useRef(null);

  const handleRun = useCallback((filters) => {
    const merged = { ...filters, bucket };
    setActiveFilters(merged);
    console.log('Run report', merged);
  }, [bucket]);

  useEffect(() => {
    if (!autoRefresh || !activeFilters) return;
    intervalRef.current = setInterval(() => {
      handleRun(activeFilters);
    }, refreshInterval);
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, refreshInterval, activeFilters, handleRun]);

  useEffect(() => {
    if (activeFilters) {
      setActiveFilters((prev) => ({ ...prev, bucket }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

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
          <ReportsUX
            onRun={handleRun}
            onExport={handleExport}
            onAddToCompare={addToCompare}
            bucket={bucket}
            onBucketChange={setBucket}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            refreshInterval={refreshInterval}
            onRefreshIntervalChange={setRefreshInterval}
          />
          <ComparePanel items={compareList} onClear={clearCompare} />
          <Tabs data={reportData} />
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
