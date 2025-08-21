import React from 'react';
import TimingFilters from './TimingFilters';
import LocationFilters from './LocationFilters';
import SensorTypeFilters from './SensorTypeFilters';
import AutoRefreshControls from './AutoRefreshControls';
import { useFilters } from '../dashboard/FiltersContext';
import styles from './ReportsUX.module.css';

function ReportsUX({
  onRun,
  onExport,
  onAddToCompare,
  bucket,
  onBucketChange,
  autoRefresh,
  onAutoRefreshChange,
  refreshInterval,
  onRefreshIntervalChange,
}) {
  const { timing, location, sensorType } = useFilters();
  const filters = { timing, location, sensorType, bucket };

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
        <TimingFilters />
        <LocationFilters />
        <SensorTypeFilters />
        <AutoRefreshControls
          bucket={bucket}
          onBucketChange={onBucketChange}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={onAutoRefreshChange}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={onRefreshIntervalChange}
        />
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.runButton}
          onClick={() => onRun?.(filters)}
        >
          Run
        </button>
        <button
          type="button"
          className={styles.exportButton}
          onClick={() => onAddToCompare?.(filters)}
        >
          Add to Compare
        </button>
        <button
          type="button"
          className={styles.exportButton}
          onClick={() => onExport?.(filters)}
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}

export default ReportsUX;
