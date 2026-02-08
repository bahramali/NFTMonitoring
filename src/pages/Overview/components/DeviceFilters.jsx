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
  layerIdOptions,
  kindOptions,
  healthOptions,
  messageKindOptions,
  viewMode,
  onViewModeChange,
}) {
  const renderOptions = (options) =>
    options.map((option) => {
      const value = typeof option === "string" ? option : option.value;
      const label = typeof option === "string" ? option : option.label;
      return (
        <option key={value} value={value}>
          {label}
        </option>
      );
    });

  return (
    <div className={styles.filtersGrid}>
      <div className={styles.filterItemWide}>
        <label htmlFor="device-monitor-search">Search</label>
        <input
          id="device-monitor-search"
          className={styles.input}
          type="search"
          placeholder="Search by deviceId or location"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="farm-filter">Farm</label>
        <select
          id="farm-filter"
          multiple
          value={filterState.farmId}
          onChange={(event) => onFilterChange("farmId", Array.from(event.target.selectedOptions).map((opt) => opt.value))}
        >
          {renderOptions(farmOptions)}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="unit-type-filter">Unit Type</label>
        <select
          id="unit-type-filter"
          multiple
          value={filterState.unitType}
          onChange={(event) => onFilterChange("unitType", Array.from(event.target.selectedOptions).map((opt) => opt.value))}
        >
          {renderOptions(unitTypeOptions)}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="unit-id-filter">Unit ID</label>
        <select
          id="unit-id-filter"
          multiple
          value={filterState.unitId}
          onChange={(event) => onFilterChange("unitId", Array.from(event.target.selectedOptions).map((opt) => opt.value))}
        >
          {renderOptions(unitIdOptions)}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="layer-id-filter">Layer ID</label>
        <select
          id="layer-id-filter"
          multiple
          value={filterState.layerId}
          onChange={(event) => onFilterChange("layerId", Array.from(event.target.selectedOptions).map((opt) => opt.value))}
        >
          {renderOptions(layerIdOptions)}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="kind-filter">Device Kind</label>
        <select
          id="kind-filter"
          multiple
          value={filterState.kind}
          onChange={(event) => onFilterChange("kind", Array.from(event.target.selectedOptions).map((opt) => opt.value))}
        >
          {renderOptions(kindOptions)}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="health-filter">Health</label>
        <select
          id="health-filter"
          multiple
          value={filterState.status}
          onChange={(event) => onFilterChange("status", Array.from(event.target.selectedOptions).map((opt) => opt.value))}
        >
          {renderOptions(healthOptions)}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="message-kind-filter">Message Kind</label>
        <select
          id="message-kind-filter"
          multiple
          value={filterState.messageKind}
          onChange={(event) =>
            onFilterChange("messageKind", Array.from(event.target.selectedOptions).map((opt) => opt.value))
          }
        >
          {renderOptions(messageKindOptions)}
        </select>
      </div>

      <div className={styles.filterItem}>
        <label htmlFor="view-mode-filter">View</label>
        <select
          id="view-mode-filter"
          value={viewMode}
          onChange={(event) => onViewModeChange(event.target.value)}
        >
          <option value="flat">Flat List</option>
          <option value="hierarchical">Hierarchical</option>
          <option value="explorer">Explorer</option>
        </select>
      </div>
    </div>
  );
}
