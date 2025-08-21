import React from 'react';
import { useFilters } from '../dashboard/FiltersContext';
import styles from './ReportsUX.module.css';

function SensorTypeFilters() {
  const { lists: { sensorTypes = [] }, sensorType, setSensorType } = useFilters();

  const allSelected = sensorTypes.length > 0 && sensorType.length === sensorTypes.length;
  const noneSelected = sensorType.length === 0;
  const selectAll = () => setSensorType(sensorTypes);
  const selectNone = () => setSensorType([]);

  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>Sensor Type</h3>
      <div className={styles.radioRow}>
        <label>
          <input
            type="radio"
            name="sensor-type-mode"
            checked={allSelected}
            onChange={selectAll}
          />
          {' '}All
        </label>
        <label>
          <input
            type="radio"
            name="sensor-type-mode"
            checked={noneSelected}
            onChange={selectNone}
          />
          {' '}None
        </label>
      </div>
      <div className={styles.options}>
        {sensorTypes.map((s) => (
          <label key={s}>
            <input
              type="checkbox"
              checked={sensorType.includes(s)}
              onChange={() => setSensorType(s)}
            />
            {' '}{s}
          </label>
        ))}
      </div>
    </div>
  );
}

export default SensorTypeFilters;
