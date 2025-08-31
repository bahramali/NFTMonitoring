import React from "react";
import styles from "./DeviceCard.module.css";

/**
 * Simple card for displaying sensor readings of a device.
 *
 * Props:
 * - compositeId: string identifying the device (e.g., "S1-L1-D1")
 * - sensors: Array<{ sensorType: string; value: number|string; unit?: string }>
 */
function DeviceCard({ compositeId, sensors = [] }) {
  return (
    <div className={styles.card} data-testid="device-card">
      <div className={styles.title}>{compositeId}</div>
      <ul className={styles.list}>
        {sensors.map((s) => (
          <li key={s.sensorType}>
            <span>{s.sensorType}</span>
            <b>
              {s.value}
              {s.unit ? ` ${s.unit}` : ""}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default React.memo(DeviceCard);
