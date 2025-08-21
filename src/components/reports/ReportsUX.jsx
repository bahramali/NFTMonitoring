import React from 'react';
import TimingFilters from './TimingFilters';
import LocationFilters from './LocationFilters';
import SensorTypeFilters from './SensorTypeFilters';
import { useFilters } from '../../context/FiltersContext';
import styles from './ReportsUX.module.css';

function ReportsUX({ onRun, onExport }) {
  const { timing, location, sensorType } = useFilters();
  const filters = { timing, location, sensorType };

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
        <TimingFilters />
        <LocationFilters />
        <SensorTypeFilters />
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
          onClick={() => onExport?.(filters)}
        >
          Export
        </button>
      </div>
    </div>
  );
}

export default ReportsUX;
