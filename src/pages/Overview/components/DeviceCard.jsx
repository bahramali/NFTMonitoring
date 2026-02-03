// src/pages/Overview/components/DeviceCard.jsx
import React, { useCallback, useMemo, useState } from "react";
import styles from "./DeviceCard.module.css";
import { getDeviceEvents } from "../../../api/deviceMonitoring.js";
import { deriveFromSensors } from "../../../utils/normalizeSensors.js";

const TELEMETRY_FIELDS = [
  { key: "lux", label: "Lux", unit: "lx" },
  { key: "air_temp_c", label: "Air Temp", unit: "°C" },
  { key: "rh_pct", label: "RH", unit: "%" },
  { key: "co2_ppm", label: "CO₂", unit: "ppm" },
];

const formatValue = (value) => {
  if (value == null) return null;
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    if (typeof value === "string" && value.trim()) return value;
    return null;
  }
  if (Number.isInteger(numberValue)) return String(numberValue);
  return numberValue.toFixed(1);
};

const normalizeStatus = (statusRaw) => {
  const status = String(statusRaw || "").trim().toLowerCase();
  if (status === "online") return "online";
  if (status === "offline") return "offline";
  return status ? status : "unknown";
};

const resolveSpectralCounts = (counts) => {
  if (!counts) return [];
  if (Array.isArray(counts)) {
    return counts
      .map((entry, index) => ({
        key: entry?.channel ?? entry?.band ?? index,
        label: entry?.channel ?? entry?.band ?? `Ch ${index + 1}`,
        value: formatValue(entry?.count ?? entry?.value ?? entry),
      }))
      .filter((entry) => entry.value !== null);
  }
  if (typeof counts === "object") {
    return Object.entries(counts)
      .map(([key, value]) => ({
        key,
        label: key,
        value: formatValue(value),
      }))
      .filter((entry) => entry.value !== null);
  }
  return [];
};

const resolveEventTimestamp = (event) =>
  event?.timestamp || event?.ts || event?.time || event?.createdAt || event?.created_at || "";

const resolveEventLabel = (event) => {
  const level =
    event?.level ||
    event?.severity ||
    event?.status ||
    event?.type ||
    event?.eventLevel ||
    "INFO";
  const code = event?.code || event?.event || event?.name || event?.eventCode || "EVENT";
  const detail = event?.detail || event?.message || event?.sensor || event?.meta || "";
  return `[${level}] ${code}${detail ? ` – ${detail}` : ""}`;
};

const formatLegacyValue = (value) =>
  value == null || Number.isNaN(value)
    ? "--"
    : Number(value) % 1 === 0
    ? String(Number(value))
    : Number(value).toFixed(1);

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

export default function DeviceCard({
  device,
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
  if (!device) {
    const derived = useMemo(() => deriveFromSensors(sensors), [sensors]);

    const name = id || compositeId || "—";

    const t = tempC ?? derived.map.temp;
    const h = humidityPct ?? derived.map.humidity;
    const co2 = co2ppm ?? derived.map.co2;
    const tValid = t != null && !Number.isNaN(t);
    const hValid = h != null && !Number.isNaN(h);
    const co2Valid = co2 != null && !Number.isNaN(co2);

    const spectrumFinal = Object.keys(spectrum).length
      ? spectrum
      : derived.spectrum || {};
    const otherFinal = Object.keys(otherLight).length
      ? otherLight
      : derived.otherLight || {};
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

        const label =
          reading.sensorName || reading.sensorType || `Sensor ${index + 1}`;
        const valueNumber = Number(rawValue);
        const formattedValue = Number.isFinite(valueNumber)
          ? formatLegacyValue(valueNumber)
          : String(rawValue);
        const suffix = reading.unit ? ` ${reading.unit}` : "";
        const display = `${formattedValue}${suffix}`.trim();

        const nameNorm = String(reading.sensorName || "")
          .trim()
          .toLowerCase();
        const typeNorm = String(reading.sensorType || "")
          .trim()
          .toLowerCase();
        const isAs7343Reading =
          /as7343/.test(nameNorm) ||
          /as7343/.test(typeNorm) ||
          /^(\d{3})nm$/.test(typeNorm) ||
          ["vis1", "vis2", "nir855", "nir", "clear"].includes(typeNorm);

        const groupInfo = isAs7343Reading
          ? getAs7343Group(reading.sensorType || reading.sensorName)
          : null;

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

      const groupedEntries = buildAs7343GroupEntries(groupedItems).map(
        (entry) => ({
          key: `as7343-${entry.key}`,
          label: entry.label,
          display: entry.display,
        })
      );

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
        entries.push({
          key: "fallback-co2",
          label: "CO₂",
          display: `${formatLegacyValue(co2)} ppm`,
        });
      }

      if (tValid && derivedMap.temp == null) {
        entries.push({
          key: "fallback-temp",
          label: "Temperature",
          display: `${formatLegacyValue(t)} °C`,
        });
      }

      if (hValid && derivedMap.humidity == null) {
        entries.push({
          key: "fallback-humidity",
          label: "Humidity",
          display: `${formatLegacyValue(h)} %`,
        });
      }

      const derivedOther = derived?.otherLight;
      if (
        Object.keys(otherFinal || {}).length &&
        (!derivedOther || Object.keys(derivedOther).length === 0)
      ) {
        if (otherFinal.lux != null) {
          entries.push({
            key: "fallback-lux",
            label: "Lux",
            display: `${formatLegacyValue(otherFinal.lux)} lux`,
          });
        }
        if (otherFinal.vis1 != null) {
          entries.push({
            key: "fallback-vis1",
            label: "VIS1",
            display: formatLegacyValue(otherFinal.vis1),
          });
        }
        if (otherFinal.vis2 != null) {
          entries.push({
            key: "fallback-vis2",
            label: "VIS2",
            display: formatLegacyValue(otherFinal.vis2),
          });
        }
        if (otherFinal.nir855 != null) {
          entries.push({
            key: "fallback-nir855",
            label: "NIR855",
            display: formatLegacyValue(otherFinal.nir855),
          });
        }
      }

      const derivedWater = derived?.water;
      if (waterFinal && (!derivedWater || Object.keys(derivedWater).length === 0)) {
        if (waterFinal.tds_ppm != null) {
          entries.push({
            key: "fallback-water-tds",
            label: "Water (TDS)",
            display: `${formatLegacyValue(waterFinal.tds_ppm)} ppm`,
          });
        }
        if (waterFinal.ec_mScm != null) {
          entries.push({
            key: "fallback-water-ec",
            label: "Water (EC)",
            display: `${formatLegacyValue(waterFinal.ec_mScm)} mS/cm`,
          });
        }
        if (waterFinal.tempC != null) {
          entries.push({
            key: "fallback-water-temp",
            label: "Water (Temp)",
            display: `${formatLegacyValue(waterFinal.tempC)} °C`,
          });
        }
        if (waterFinal.do_mgL != null) {
          entries.push({
            key: "fallback-water-do",
            label: "Water (DO)",
            display: `${formatLegacyValue(waterFinal.do_mgL)} mg/L`,
          });
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
                display: formatLegacyValue(value),
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
    }, [
      co2Valid,
      co2,
      derived,
      hasAS7343,
      h,
      hValid,
      otherFinal,
      spectrumFinal,
      t,
      tValid,
      waterFinal,
    ]);

    const allSensorReadings = useMemo(
      () => [...fallbackEntries, ...sensorEntries],
      [fallbackEntries, sensorEntries]
    );

    return (
      <article className={styles.card}>
        <div className={styles.legacyHeader}>
          <div className={styles.legacyBadge}>{name}</div>
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
      </article>
    );
  }

  const {
    deviceId,
    deviceType,
    status,
    farm,
    unitType,
    unitId,
    layerId,
    telemetry,
    health,
    uptime,
  } = device || {};

  const normalizedStatus = normalizeStatus(status);
  const headerTitle = `${deviceType || "Device"} / ${deviceId || "—"}`;

  const telemetryEntries = useMemo(() => {
    if (!telemetry || typeof telemetry !== "object") return [];
    return TELEMETRY_FIELDS.map((field) => {
      if (!(field.key in telemetry)) return null;
      const formatted = formatValue(telemetry[field.key]);
      if (formatted == null) return null;
      return {
        key: field.key,
        label: field.label,
        value: field.unit ? `${formatted} ${field.unit}` : formatted,
      };
    }).filter(Boolean);
  }, [telemetry]);

  const spectralEntries = useMemo(
    () => resolveSpectralCounts(telemetry?.as7343_counts),
    [telemetry]
  );

  const healthEntries = useMemo(() => {
    if (!health || typeof health !== "object") return [];
    return Object.entries(health)
      .filter(([, value]) => typeof value === "boolean")
      .map(([key, value]) => ({
        key,
        value,
      }));
  }, [health]);

  const [eventsState, setEventsState] = useState({
    loaded: false,
    loading: false,
    error: "",
    cursor: null,
    hasMore: true,
    events: [],
  });
  const [eventsOpen, setEventsOpen] = useState(false);

  const loadEvents = useCallback(
    async (nextCursor = null) => {
      if (!deviceId || eventsState.loading) return;
      setEventsState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const payload = await getDeviceEvents(deviceId, { cursor: nextCursor });
        const events =
          (Array.isArray(payload) && payload) ||
          payload?.events ||
          payload?.items ||
          payload?.data ||
          [];
        const cursor =
          payload?.nextCursor ||
          payload?.next_cursor ||
          payload?.cursor ||
          payload?.nextPage ||
          null;
        const hasMore =
          typeof payload?.hasMore === "boolean"
            ? payload.hasMore
            : Boolean(cursor);
        setEventsState((prev) => ({
          loaded: true,
          loading: false,
          error: "",
          cursor,
          hasMore,
          events: nextCursor ? [...prev.events, ...events] : events,
        }));
      } catch (error) {
        setEventsState((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || "Unable to load events.",
        }));
      }
    },
    [deviceId, eventsState.loading]
  );

  const handleEventsToggle = useCallback(
    (event) => {
      const nextOpen = Boolean(event?.target?.open);
      setEventsOpen(nextOpen);
      if (nextOpen && !eventsState.loaded) {
        loadEvents();
      }
    },
    [eventsState.loaded, loadEvents]
  );

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>{headerTitle}</div>
          <div className={styles.meta}>
            <span>Farm: {farm || "—"}</span>
            <span>Unit Type: {unitType || "—"}</span>
            <span>Unit ID: {unitId || "—"}</span>
            {layerId ? <span>Layer: {layerId}</span> : null}
          </div>
        </div>
        <div className={`${styles.status} ${styles[`status${normalizedStatus}`] || ""}`}>
          {normalizedStatus === "online" ? "🟢 online" : normalizedStatus === "offline" ? "🔴 offline" : normalizedStatus}
        </div>
      </header>

      {uptime ? <div className={styles.uptime}>Uptime: {uptime}</div> : null}

      {telemetryEntries.length > 0 ? (
        <section className={styles.section}>
          <h4>Telemetry</h4>
          <div className={styles.telemetryGrid}>
            {telemetryEntries.map((entry) => (
              <div key={entry.key} className={styles.telemetryItem}>
                <span>{entry.label}</span>
                <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {healthEntries.length > 0 ? (
        <section className={styles.section}>
          <h4>Health</h4>
          <div className={styles.healthGrid}>
            {healthEntries.map((entry) => (
              <div key={entry.key} className={styles.healthItem}>
                <span className={styles.healthName}>{entry.key}</span>
                <span
                  className={entry.value ? styles.healthOk : styles.healthFail}
                  title={entry.value ? "sensor responding" : "sensor missing / not responding"}
                >
                  {entry.value ? "✔️" : "⚠️"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {spectralEntries.length > 0 ? (
        <details className={styles.details}>
          <summary>Spectral data (AS7343)</summary>
          <div className={styles.spectralTable}>
            {spectralEntries.map((entry) => (
              <div key={entry.key} className={styles.spectralRow}>
                <span>{entry.label}</span>
                <span>{entry.value}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <details className={styles.details} onToggle={handleEventsToggle}>
        <summary>Event log</summary>
        <div className={styles.events}>
          {eventsState.loading && eventsState.events.length === 0 ? (
            <div className={styles.muted}>Loading events…</div>
          ) : null}
          {eventsState.error ? <div className={styles.error}>{eventsState.error}</div> : null}
          {!eventsState.loading && eventsState.loaded && eventsState.events.length === 0 ? (
            <div className={styles.muted}>No events reported.</div>
          ) : null}
          {eventsState.events.map((event, index) => (
            <div key={`${resolveEventTimestamp(event)}-${index}`} className={styles.eventRow}>
              <span className={styles.eventLabel}>{resolveEventLabel(event)}</span>
              <span className={styles.eventTime}>{resolveEventTimestamp(event)}</span>
            </div>
          ))}
          {eventsOpen && eventsState.hasMore ? (
            <button
              type="button"
              className={styles.loadMore}
              onClick={() => loadEvents(eventsState.cursor)}
              disabled={eventsState.loading}
            >
              {eventsState.loading ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </div>
      </details>
    </article>
  );
}
