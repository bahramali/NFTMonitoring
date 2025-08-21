import React from 'react';
import { useFilters } from '../dashboard/FiltersContext';
import styles from './ReportsUX.module.css';

function TimingFilters() {
  const { lists: { timings = [] }, timing, setTiming } = useFilters();

  const allSelected = timings.length > 0 && timing.length === timings.length;
  const noneSelected = timing.length === 0;
  const selectAll = () => setTiming(timings);
  const selectNone = () => setTiming([]);

  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>Timing</h3>
      <div className={styles.radioRow}>
        <label>
          <input
            type="radio"
            name="timing-mode"
            checked={allSelected}
            onChange={selectAll}
          />
          {' '}All
        </label>
        <label>
          <input
            type="radio"
            name="timing-mode"
            checked={noneSelected}
            onChange={selectNone}
          />
          {' '}None
        </label>
      </div>
      <div className={styles.options}>
        {timings.map((t) => (
          <label key={t}>
            <input
              type="checkbox"
              checked={timing.includes(t)}
              onChange={() => setTiming(t)}
            />
            {' '}{t}
          </label>
        ))}
      </div>
    </div>
  );
}

export default TimingFilters;
