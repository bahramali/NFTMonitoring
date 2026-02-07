import React, { useMemo, useState } from "react";
import DeviceStatusBadge from "./DeviceStatusBadge.jsx";
import { formatMetricValue, getMetricLabel } from "../utils/deviceHealth.js";
import { METRIC_DEFINITIONS } from "../../../config/deviceMonitoring.js";
import styles from "./Overview.module.css";

const MESSAGE_TABS = ["telemetry", "status", "event"];

const formatAbsolute = (timestamp) => {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString();
};

const formatRelative = (timestamp, nowMs) => {
  if (!timestamp) return "—";
  const diff = Math.max(0, nowMs - timestamp);
  if (diff < 1000) return "Just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatDelta = (key, value) => {
  if (value == null || !Number.isFinite(value)) return "—";
  const definition = METRIC_DEFINITIONS[key] ?? {};
  const precision = Number.isFinite(definition.precision) ? definition.precision : 1;
  const unit = definition.unit ? ` ${definition.unit}` : "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(precision)}${unit}`;
};

const formatAge = (ageMs) => {
  if (!Number.isFinite(ageMs)) return "—";
  if (ageMs < 1000) return "Just now";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

const getFreshnessStatus = (ageMs, expectedIntervalSec) => {
  if (!Number.isFinite(ageMs)) return "missing";
  const expectedMs = (expectedIntervalSec ?? 0) * 1000;
  if (!expectedMs) return "fresh";
  if (ageMs <= expectedMs * 2) return "fresh";
  if (ageMs <= expectedMs * 4) return "stale";
  return "missing";
};

const Sparkline = ({ points }) => {
  if (!points || points.length < 2) {
    return <div className={styles.sparklineEmpty}>—</div>;
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 100 - ((point.value - min) / range) * 100;
    return `${x},${y}`;
  });
  return (
    <svg className={styles.sparkline} viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

export default function DeviceDetailsDrawer({
  device,
  health,
  expectedRate,
  isOpen,
  onClose,
  onDebug,
  allowDebug,
  messages,
  metrics,
  healthReasons,
  timeWindowMs,
  onTimeWindowChange,
  timeWindowOptions,
  nowMs,
}) {
  const [tab, setTab] = useState("telemetry");
  const [expandedMessage, setExpandedMessage] = useState(null);

  const dataQuality = device?.dataQuality ?? {
    expected: 0,
    received: 0,
    percent: 100,
    missingCritical: [],
    missingOptional: [],
  };
  const expectedMetrics = useMemo(() => metrics.map((metric) => metric.key), [metrics]);
  const receivedMetricKeys = useMemo(
    () => metrics.filter((metric) => metric.value != null).map((metric) => metric.key),
    [metrics],
  );
  const missingMetricKeys = useMemo(
    () => metrics.filter((metric) => metric.value == null).map((metric) => metric.key),
    [metrics],
  );

  const filteredMessages = useMemo(
    () => messages.filter((message) => message.kind === tab).slice(0, 20),
    [messages, tab],
  );

  const messageSummaries = useMemo(() => {
    return filteredMessages.map((entry, index) => {
      const previous = filteredMessages[index + 1];
      const currentMetrics = entry.metricsSnapshot || {};
      const prevMetrics = previous?.metricsSnapshot || {};
      const changes = Object.keys(currentMetrics)
        .filter((key) => currentMetrics[key] != null && prevMetrics[key] != null && currentMetrics[key] !== prevMetrics[key])
        .slice(0, 3)
        .map((key) => `${getMetricLabel(key)} ${formatMetricValue(key, prevMetrics[key])} → ${formatMetricValue(key, currentMetrics[key])}`);
      return {
        ...entry,
        changeSummary: changes.length ? changes.join(" • ") : null,
      };
    });
  }, [filteredMessages]);

  if (!isOpen || !device) return null;

  return (
    <div className={styles.drawerBackdrop} role="presentation" onClick={onClose}>
      <aside className={styles.drawerPanel} role="dialog" onClick={(event) => event.stopPropagation()}>
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerEyebrow}>Device Details</p>
            <h3>{device.deviceId}</h3>
            <p className={styles.drawerSubtext}>
              {device.deviceKind} • {device.locationLabel}
            </p>
          </div>
          <div className={styles.drawerHeaderActions}>
            <div className={styles.badgeStack}>
              <DeviceStatusBadge status={health.status} />
              <span className={`${styles.telemetryBadge} ${styles[`telemetry${device.telemetryStatus}`] || ""}`}>
                {device.telemetryStatus === "fresh"
                  ? "Telemetry: Fresh"
                  : device.telemetryStatus === "stale"
                    ? "Telemetry: Stale"
                    : "Telemetry: Missing"}
              </span>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        <section className={styles.drawerSummary}>
          <div>
            <p className={styles.drawerLabel}>Last seen</p>
            <p className={styles.drawerValue}>{device.lastSeenAbsolute}</p>
            <p className={styles.drawerMeta}>{device.lastSeenRelative}</p>
          </div>
          <div>
            <p className={styles.drawerLabel}>Last telemetry age</p>
            <p className={styles.drawerValue}>{formatAge(device.lastTelemetryAgeMs)}</p>
            <p className={styles.drawerMeta}>{device.lastTelemetryAbsolute}</p>
          </div>
          <div>
            <p className={styles.drawerLabel}>Msg rate</p>
            <p className={styles.drawerValue}>{device.msgRate}/min</p>
            <p className={styles.drawerMeta}>Expected {expectedRate ?? "—"}/min</p>
          </div>
          <div>
            <p className={styles.drawerLabel}>Data quality</p>
            <p className={styles.drawerValue}>{dataQuality.percent}%</p>
            <p className={styles.drawerMeta}>
              {dataQuality.received}/{dataQuality.expected} metrics
            </p>
          </div>
          {allowDebug ? (
            <button type="button" className={styles.primaryButton} onClick={onDebug}>
              Debug stream
            </button>
          ) : null}
        </section>

        <section className={styles.drawerSection}>
          <div className={styles.sectionHeaderRow}>
            <h4>Sensor Overview</h4>
            <div className={styles.windowSelector}>
              {timeWindowOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.tabButton} ${timeWindowMs === option.value ? styles.activeTab : ""}`}
                  onClick={() => onTimeWindowChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.metricsGrid}>
            {metrics.length ? (
              metrics.map((metric) => (
                <div key={metric.key} className={styles.metricCard}>
                  <div className={styles.metricHeader}>
                    <p className={styles.metricLabel}>{getMetricLabel(metric.key)}</p>
                    <div className={styles.metricIndicators}>
                      <span
                        className={`${styles.freshnessDot} ${styles[`freshness${getFreshnessStatus(
                          metric.lastUpdatedMs ? nowMs - metric.lastUpdatedMs : null,
                          device.expectedIntervalSec,
                        )}`] || ""}`}
                      />
                      <span className={`${styles.trendBadge} ${styles[`trend${metric.trend.direction}`] || ""}`}>
                        {metric.trend.direction === "up" ? "↑" : metric.trend.direction === "down" ? "↓" : "→"}
                      </span>
                    </div>
                  </div>
                  <p className={styles.metricValue}>{formatMetricValue(metric.key, metric.value)}</p>
                  <p className={styles.metricDelta}>
                    Δ {formatDelta(metric.key, metric.trend.delta)}
                    {metric.value == null ? " • Missing" : ""}
                  </p>
                  <Sparkline points={metric.sparkline} />
                </div>
              ))
            ) : (
              <p className={styles.metricEmpty}>No sensor data available yet.</p>
            )}
          </div>
        </section>

        <section className={styles.drawerSection}>
          <h4>Sensor Health</h4>
          <div className={styles.healthPanel}>
            <div className={styles.healthRow}>
              <p className={styles.healthLabel}>Sensor health</p>
              {device.lastTelemetryHealth ? (
                <div className={styles.healthChips}>
                  {Object.entries(device.lastTelemetryHealth).map(([key, value]) => (
                    <span
                      key={key}
                      className={`${styles.healthChip} ${
                        value ? styles.healthChipOk : styles.healthChipFail
                      }`}
                    >
                      {key}
                      {!value ? <span className={styles.healthChipMeta}>No response</span> : null}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.healthMuted}>— (not reported)</p>
              )}
            </div>
            <div className={styles.healthRow}>
              <p className={styles.healthLabel}>Data quality</p>
              <div>
                <p className={styles.healthMeta}>
                  Expected metrics: <strong>{expectedMetrics.length}</strong> • Received metrics:{" "}
                  <strong>{receivedMetricKeys.length}</strong>
                </p>
                {missingMetricKeys.length > 0 ? (
                  <p className={styles.healthAlert}>
                    Missing: {missingMetricKeys.map(getMetricLabel).join(", ")}
                  </p>
                ) : (
                  <p className={styles.healthMuted}>All expected metrics reported.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.drawerSection}>
          <h4>Health reasons</h4>
          <div className={styles.reasonsPanel}>
            {healthReasons.length > 0 ? (
              <ul>
                {healthReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p>No health issues detected.</p>
            )}
          </div>
        </section>

        <section className={styles.drawerSection}>
          <h4>Latest Messages</h4>
          <div className={styles.tabRow}>
            {MESSAGE_TABS.map((option) => (
              <button
                key={option}
                type="button"
                className={`${styles.tabButton} ${tab === option ? styles.activeTab : ""}`}
                onClick={() => setTab(option)}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <div className={styles.timeline}>
            {filteredMessages.length === 0 ? <p>No recent {tab} messages.</p> : null}
            {messageSummaries.map((entry) => (
              <div key={entry.id} className={styles.timelineRow}>
                <div className={styles.timelineDetails}>
                  <p className={styles.timelineTitle}>{entry.summary}</p>
                  <p className={styles.timelineMeta}>
                    {formatAbsolute(entry.timestamp)} • {formatRelative(entry.timestamp, nowMs)}
                  </p>
                  <p className={styles.timelineMeta}>{entry.location}</p>
                  {entry.changeSummary ? <p className={styles.timelineChange}>{entry.changeSummary}</p> : null}
                  {allowDebug ? (
                    <details className={styles.rawDetails} open={expandedMessage === entry.id}>
                      <summary
                        onClick={() =>
                          setExpandedMessage((prev) => (prev === entry.id ? null : entry.id))
                        }
                      >
                        View raw JSON
                      </summary>
                      <pre>{JSON.stringify(entry.raw, null, 2)}</pre>
                    </details>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
