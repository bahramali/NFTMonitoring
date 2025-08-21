import React from 'react';
import styles from './ReportsUX.module.css';

function AutoRefreshControls({
  bucket,
  onBucketChange,
  autoRefresh,
  onAutoRefreshChange,
  refreshInterval,
  onRefreshIntervalChange,
}) {
  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>Auto Refresh</h3>
      <div className={styles.radioRow}>
        <label>
          Bucket:
          <select
            className={styles.intervalSelect}
            value={bucket}
            onChange={(e) => onBucketChange?.(e.target.value)}
          >
            <option value="1m">1min</option>
            <option value="5m">5min</option>
            <option value="15m">15min</option>
            <option value="1h">1h</option>
          </select>
        </label>
      </div>
      <div className={styles.radioRow}>
        <label>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => onAutoRefreshChange?.(e.target.checked)}
          />{' '}
          Auto Refresh
        </label>
        <select
          className={styles.intervalSelect}
          value={refreshInterval}
          onChange={(e) => onRefreshIntervalChange?.(Number(e.target.value))}
          disabled={!autoRefresh}
        >
          <option value={60000}>1min</option>
          <option value={300000}>5min</option>
          <option value={600000}>10min</option>
          <option value={1800000}>30min</option>
          <option value={3600000}>1h</option>
        </select>
      </div>
    </div>
  );
}

export default AutoRefreshControls;
