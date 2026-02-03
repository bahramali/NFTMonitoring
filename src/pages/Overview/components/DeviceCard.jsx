// src/pages/Overview/components/DeviceCard.jsx
import React, { useCallback, useMemo, useState } from "react";
import styles from "./DeviceCard.module.css";
import { getDeviceEvents } from "../../../api/deviceMonitoring.js";

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

export default function DeviceCard({ device }) {
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
