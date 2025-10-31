// src/pages/Overview/components/DeviceCard.jsx
import React, { useMemo } from "react";
import styles from "./DeviceCard.module.css";
import { deriveFromSensors } from "../../../utils/normalizeSensors.js";

/* helpers */
const fmt = (v) =>
  v == null || Number.isNaN(v)
    ? "--"
    : Number(v) % 1 === 0
    ? String(Number(v))
    : Number(v).toFixed(1);

const getAs7343Group = (sensorTypeRaw) => {
  const type = String(sensorTypeRaw || "").trim().toLowerCase();
  const nmMatch = /^(\d{3})nm$/.exec(type);

  if (nmMatch) {
    const nm = Number(nmMatch[1]);
    if (nm < 500) return { key: "blue", label: "AS7343 (Blue band)" };
    if (nm < 600) return { key: "green", label: "AS7343 (Green band)" };
    return { key: "red", label: "AS7343 (Red/NIR band)" };
  }

  if (type === "vis1" || type === "vis2" || type === "clear") {
    return { key: "green", label: "AS7343 (Green band)" };
  }

  if (type === "nir855" || type === "nir") {
    return { key: "red", label: "AS7343 (Red/NIR band)" };
  }

  return null;
};

const buildAs7343GroupEntries = (items = []) => {
  const order = [];
  const groups = new Map();

  items.forEach((item) => {
    if (!item?.groupKey) return;
    if (!groups.has(item.groupKey)) {
      groups.set(item.groupKey, { label: item.groupLabel, items: [] });
      order.push(item.groupKey);
    }
    const group = groups.get(item.groupKey);
    group.items.push({
      label: item.itemLabel || item.groupLabel,
      display: item.display,
    });
  });

  return order
    .map((key) => {
      const group = groups.get(key);
      if (!group || group.items.length === 0) return null;
      const joined = group.items
        .map((entry) => `${entry.label}: ${entry.display}`)
        .join(", ");
      return {
        key,
        label: group.label,
        display: `[${joined}]`,
      };
    })
    .filter(Boolean);
};


/**
 * Props:
 *  id?, compositeId?, sensors[]
 *  tempC?, humidityPct?, co2ppm?, spectrum?, otherLight?, water?
 */
export default function DeviceCard({
  id,
  compositeId,
  sensors = [],
  tempC,
  humidityPct,
  co2ppm,
  spectrum = {},
  otherLight = {},
  water = null,
}) {
  const derived = useMemo(() => deriveFromSensors(sensors), [sensors]);

  const name = id || compositeId || "—";

  const t = tempC ?? derived.map.temp;
  const h = humidityPct ?? derived.map.humidity;
  const co2 = co2ppm ?? derived.map.co2;
  const tValid = t != null && !Number.isNaN(t);
  const hValid = h != null && !Number.isNaN(h);
  const co2Valid = co2 != null && !Number.isNaN(co2);

  const spectrumFinal = Object.keys(spectrum).length ? spectrum : (derived.spectrum || {});
  const otherFinal = Object.keys(otherLight).length ? otherLight : (derived.otherLight || {});
  const waterFinal = water || derived.water;
  const { entries: sensorEntries, hasAS7343 } = useMemo(() => {
    if (!Array.isArray(sensors) || sensors.length === 0) {
      return { entries: [], hasAS7343: false };
    }

    const singles = [];
    const groupedItems = [];
    let firstGroupIndex = null;
    let hasGroup = false;

    sensors.forEach((reading, index) => {
      if (!reading) return;
      const rawValue = reading.value;
      if (rawValue == null || rawValue === "") return;

      const label = reading.sensorName || reading.sensorType || `Sensor ${index + 1}`;
      const valueNumber = Number(rawValue);
      const formattedValue = Number.isFinite(valueNumber) ? fmt(valueNumber) : String(rawValue);
      const suffix = reading.unit ? ` ${reading.unit}` : "";
      const display = `${formattedValue}${suffix}`.trim();

      const nameNorm = String(reading.sensorName || "").trim().toLowerCase();
      const typeNorm = String(reading.sensorType || "").trim().toLowerCase();
      const isAs7343Reading =
        /as7343/.test(nameNorm) ||
        /as7343/.test(typeNorm) ||
        /^(\d{3})nm$/.test(typeNorm) ||
        ["vis1", "vis2", "nir855", "nir", "clear"].includes(typeNorm);

      const groupInfo = isAs7343Reading ? getAs7343Group(reading.sensorType || reading.sensorName) : null;

      if (groupInfo) {
        hasGroup = true;
        if (firstGroupIndex == null) firstGroupIndex = singles.length;
        groupedItems.push({
          groupKey: groupInfo.key,
          groupLabel: groupInfo.label,
          itemLabel: reading.sensorType || label,
          display,
        });
        return;
      }

      if (isAs7343Reading) {
        hasGroup = true;
      }

      singles.push({
        key: `${label}-${index}`,
        label,
        display,
      });
    });

    const groupedEntries = buildAs7343GroupEntries(groupedItems).map((entry) => ({
      key: `as7343-${entry.key}`,
      label: entry.label,
      display: entry.display,
    }));

    if (!groupedEntries.length) {
      return { entries: singles, hasAS7343: hasGroup };
    }

    const insertAt = firstGroupIndex ?? singles.length;
    const combined = [
      ...singles.slice(0, insertAt),
      ...groupedEntries,
      ...singles.slice(insertAt),
    ];

    return { entries: combined, hasAS7343: true };
  }, [sensors]);

  const fallbackEntries = useMemo(() => {
    const entries = [];
    const derivedMap = derived?.map || {};

    if (co2Valid && derivedMap.co2 == null) {
      entries.push({ key: "fallback-co2", label: "CO₂", display: `${fmt(co2)} ppm` });
    }

    if (tValid && derivedMap.temp == null) {
      entries.push({ key: "fallback-temp", label: "Temperature", display: `${fmt(t)} °C` });
    }

    if (hValid && derivedMap.humidity == null) {
      entries.push({ key: "fallback-humidity", label: "Humidity", display: `${fmt(h)} %` });
    }

    const derivedOther = derived?.otherLight;
    if (Object.keys(otherFinal || {}).length && (!derivedOther || Object.keys(derivedOther).length === 0)) {
      if (otherFinal.lux != null) {
        entries.push({ key: "fallback-lux", label: "Lux", display: `${fmt(otherFinal.lux)} lux` });
      }
      if (otherFinal.vis1 != null) {
        entries.push({ key: "fallback-vis1", label: "VIS1", display: fmt(otherFinal.vis1) });
      }
      if (otherFinal.vis2 != null) {
        entries.push({ key: "fallback-vis2", label: "VIS2", display: fmt(otherFinal.vis2) });
      }
      if (otherFinal.nir855 != null) {
        entries.push({ key: "fallback-nir855", label: "NIR855", display: fmt(otherFinal.nir855) });
      }
    }

    const derivedWater = derived?.water;
    if (waterFinal && (!derivedWater || Object.keys(derivedWater).length === 0)) {
      if (waterFinal.tds_ppm != null) {
        entries.push({ key: "fallback-water-tds", label: "Water (TDS)", display: `${fmt(waterFinal.tds_ppm)} ppm` });
      }
      if (waterFinal.ec_mScm != null) {
        entries.push({ key: "fallback-water-ec", label: "Water (EC)", display: `${fmt(waterFinal.ec_mScm)} mS/cm` });
      }
      if (waterFinal.tempC != null) {
        entries.push({ key: "fallback-water-temp", label: "Water (Temp)", display: `${fmt(waterFinal.tempC)} °C` });
      }
      if (waterFinal.do_mgL != null) {
        entries.push({ key: "fallback-water-do", label: "Water (DO)", display: `${fmt(waterFinal.do_mgL)} mg/L` });
      }
    }

    if (!hasAS7343 && spectrumFinal && Object.keys(spectrumFinal).length) {
      const groupedFallback = buildAs7343GroupEntries(
        Object.entries(spectrumFinal)
          .map(([key, value]) => {
            const groupInfo = getAs7343Group(key);
            if (!groupInfo) return null;
            return {
              groupKey: groupInfo.key,
              groupLabel: groupInfo.label,
              itemLabel: key,
              display: fmt(value),
            };
          })
          .filter(Boolean)
      ).map((entry) => ({
        key: `fallback-${entry.key}`,
        label: entry.label,
        display: entry.display,
      }));

      entries.push(...groupedFallback);
    }

    return entries;
  }, [co2Valid, co2, derived, hasAS7343, h, hValid, otherFinal, spectrumFinal, t, tValid, waterFinal]);

  const allSensorReadings = useMemo(
    () => [...fallbackEntries, ...sensorEntries],
    [fallbackEntries, sensorEntries]
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>{name}</div>
        </div>
        {allSensorReadings.length > 0 && (
          <div className={styles.kv}>
            <div className={styles.kvTitle}>All sensor readings</div>
            <div className={styles.pairGrid}>
              {allSensorReadings.map(({ key, label, display }) => (
                <div key={key} className={styles.pairChip}>
                  <span>{label}</span>
                  <span>{display}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
