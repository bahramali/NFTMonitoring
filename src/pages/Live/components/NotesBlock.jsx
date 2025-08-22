import React from 'react';
import styles from '../../common/SensorDashboard.module.css';
import idealRangeConfig from '../../../idealRangeConfig.js';
import {bandMap, knownFields} from '../../../components/dashboard.constants';

function NotesBlock({ mergedDevices = {} }) {
  const metaFields = new Set(['timestamp', 'deviceId', 'compositeId', 'layer']);

  const sensors = new Set();
  for (const dev of Object.values(mergedDevices)) {
    if (Array.isArray(dev?.sensors)) {
      for (const s of dev.sensors) {
        const type = s && (s.sensorType || s.valueType);
        if (type) sensors.add(bandMap[type] || type);
      }
    }
    for (const key of Object.keys(dev || {})) {
      if (key === 'health' || key === 'sensors' || key === 'controllers') continue;
      if (metaFields.has(key)) continue;
      if (Array.isArray(dev?.sensors) && knownFields.has(key)) continue;
      sensors.add(bandMap[key] || key);
    }
  }

  const notes = [];
  for (const key of sensors) {
    const cfg = idealRangeConfig[key];
    if (cfg?.description) notes.push(`${key}: ${cfg.description}`);
  }

  if (!notes.length) return null;

  return (
    <div className={styles.noteBlock}>
      <div className={styles.noteTitle}>Notes:</div>
      <ul>
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

export default NotesBlock;
