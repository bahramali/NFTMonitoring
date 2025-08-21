import React from 'react';
import { useFilters } from '../../context/FiltersContext';
import styles from './ReportsUX.module.css';

function LocationFilters() {
  const { lists: { locations = [] }, location, setLocation } = useFilters();

  const allSelected = locations.length > 0 && location.length === locations.length;
  const noneSelected = location.length === 0;
  const selectAll = () => setLocation(locations);
  const selectNone = () => setLocation([]);

  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>Location</h3>
      <div className={styles.radioRow}>
        <label>
          <input
            type="radio"
            name="location-mode"
            checked={allSelected}
            onChange={selectAll}
          />
          {' '}All
        </label>
        <label>
          <input
            type="radio"
            name="location-mode"
            checked={noneSelected}
            onChange={selectNone}
          />
          {' '}None
        </label>
      </div>
      <div className={styles.options}>
        {locations.map((l) => (
          <label key={l}>
            <input
              type="checkbox"
              checked={location.includes(l)}
              onChange={() => setLocation(l)}
            />
            {' '}{l}
          </label>
        ))}
      </div>
    </div>
  );
}

export default LocationFilters;
