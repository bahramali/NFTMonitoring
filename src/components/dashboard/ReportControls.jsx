import React from 'react';
import styles from '../SensorDashboard.module.css';

function ReportControls({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onNow,
  onApply,
  selectedDevice,
  availableCompositeIds = [],
  onDeviceChange,
  autoRefresh,
  onAutoRefreshChange,
  refreshInterval,
  onRefreshIntervalChange,
  rangeLabel
}) {
  return (
    <fieldset className={styles.historyControls}>
      <legend className={styles.historyLegend}>Historical Range</legend>
      <div className={styles.filterRow}>
        <label>
          From:
          <input type="datetime-local" value={fromDate} onChange={onFromDateChange} />
        </label>
        <span className={styles.fieldSpacer}>–</span>
        <label className={styles.filterLabel}>
          To:
          <input type="datetime-local" value={toDate} onChange={onToDateChange} />
        </label>
        <button type="button" className={styles.nowButton} onClick={onNow}>
          Now
        </button>
        <button type="button" className={styles.applyButton} onClick={onApply}>
          Apply
        </button>
      </div>

      <div className={styles.filterRow}>
        <label className={styles.filterLabel}>
          Composite ID:
          <select className={styles.intervalSelect} value={selectedDevice} onChange={onDeviceChange}>
            {availableCompositeIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.filterRow}>
        <label className={styles.filterLabel}>
          <input type="checkbox" checked={autoRefresh} onChange={onAutoRefreshChange} />{' '}
          Auto Refresh
        </label>
        <select
          className={styles.intervalSelect}
          value={refreshInterval}
          onChange={onRefreshIntervalChange}
          disabled={!autoRefresh}
        >
          <option value={60000}>1min</option>
          <option value={300000}>5min</option>
          <option value={600000}>10min</option>
          <option value={1800000}>30min</option>
          <option value={3600000}>1h</option>
        </select>
      </div>

      <div className={styles.rangeLabel}>{rangeLabel}</div>
    </fieldset>
  );
}

export default ReportControls;
