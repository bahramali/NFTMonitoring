import React from "react";
import styles from "./Overview.module.css";

export default function DeviceFilters({
  search,
  onSearch,
  filterState,
  onFilterChange,
  farmOptions,
  unitTypeOptions,
  unitIdOptions,
}) {
  return (
    <div className={styles.filtersGrid}>
      <div className={styles.filterItemWide}>
        <label htmlFor="device-monitor-search">Search</label>
        <input
          id="device-monitor-search"
          className={styles.input}
          type="search"
          placeholder="Search by farm, unit, layer, device"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="farm-filter">Farm</label>
        <select
          id="farm-filter"
          value={filterState.farmId}
          onChange={(event) => onFilterChange("farmId", event.target.value)}
        >
          <option value="">All</option>
          {farmOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="unit-type-filter">Unit Type</label>
        <select
          id="unit-type-filter"
          value={filterState.unitType}
          onChange={(event) => onFilterChange("unitType", event.target.value)}
        >
          <option value="">All</option>
          {unitTypeOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="unit-id-filter">Unit ID</label>
        <select
          id="unit-id-filter"
          value={filterState.unitId}
          onChange={(event) => onFilterChange("unitId", event.target.value)}
        >
          <option value="">All</option>
          {unitIdOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="kind-filter">Kind</label>
        <select
          id="kind-filter"
          value={filterState.kind}
          onChange={(event) => onFilterChange("kind", event.target.value)}
        >
          <option value="">All</option>
          <option value="telemetry">Telemetry</option>
          <option value="status">Status</option>
          <option value="event">Event</option>
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="status-filter">Status</label>
        <select
          id="status-filter"
          value={filterState.status}
          onChange={(event) => onFilterChange("status", event.target.value)}
        >
          <option value="">All</option>
          <option value="online">Online</option>
          <option value="stale">Stale</option>
          <option value="offline">Offline</option>
          <option value="error">Error</option>
        </select>
      </div>
    </div>
  );
}
