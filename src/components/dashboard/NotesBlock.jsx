import React from 'react';
import styles from '../SensorDashboard.module.css';
import idealRangeConfig from '../../idealRangeConfig.js';

function NotesBlock({ mergedDevices = {} }) {
  const bandMap = {
    F1: '415nm',
    F2: '445nm',
    F3: '480nm',
    F4: '515nm',
    F5: '555nm',
    F6: '590nm',
    F7: '630nm',
    F8: '680nm'
  };
  const knownFields = new Set([
    'temperature',
    'humidity',
    'lux',
    'tds',
    'ec',
    'ph',
    'do',
    'F1',
    'F2',
    'F3',
    'F4',
    'F5',
    'F6',
    'F7',
    'F8',
    'clear',
    'nir'
  ]);
  const metaFields = new Set(['timestamp', 'deviceId', 'location']);

  const sensors = new Set();
  for (const dev of Object.values(mergedDevices)) {
    if (Array.isArray(dev?.sensors)) {
      for (const s of dev.sensors) {
        const type = s && (s.type || s.valueType);
        if (type) sensors.add(bandMap[type] || type);
      }
    }
    for (const key of Object.keys(dev || {})) {
      if (key === 'health' || key === 'sensors') continue;
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
