import React, { useMemo, useState } from "react";
import DeviceStatusBadge from "./DeviceStatusBadge.jsx";
import { formatMetricValue, getMetricLabel } from "../utils/deviceHealth.js";
import styles from "./Overview.module.css";

const MESSAGE_TABS = ["telemetry", "status", "event"];

const formatAbsolute = (timestamp) => {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString();
};

export default function DeviceDetailsDrawer({
  device,
  health,
  expectedRate,
  dataQuality,
  isOpen,
  onClose,
  onDebug,
  allowDebug,
  messages,
  metrics,
}) {
  const [tab, setTab] = useState("telemetry");

  const filteredMessages = useMemo(
    () => messages.filter((message) => message.kind === tab).slice(0, 20),
    [messages, tab],
  );

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
            <DeviceStatusBadge status={health.status} />
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
          <h4>Latest metrics</h4>
          <div className={styles.metricsGrid}>
            {metrics.map((metric) => (
              <div key={metric.key} className={styles.metricCard}>
                <p className={styles.metricLabel}>{getMetricLabel(metric.key)}</p>
                <p className={styles.metricValue}>{formatMetricValue(metric.key, metric.value)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.drawerSection}>
          <h4>Data quality</h4>
          <div className={styles.qualityPanel}>
            <p>
              Expected: <strong>{dataQuality.expected}</strong> • Received:{" "}
              <strong>{dataQuality.received}</strong>
            </p>
            {dataQuality.missingCritical.length > 0 ? (
              <p className={styles.qualityAlert}>
                Missing critical: {dataQuality.missingCritical.map(getMetricLabel).join(", ")}
              </p>
            ) : null}
            {dataQuality.missingOptional.length > 0 ? (
              <p className={styles.qualityMuted}>
                Missing: {dataQuality.missingOptional.map(getMetricLabel).join(", ")}
              </p>
            ) : null}
          </div>
        </section>

        <section className={styles.drawerSection}>
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
            {filteredMessages.map((entry) => (
              <div key={entry.id} className={styles.timelineRow}>
                <div>
                  <p className={styles.timelineTitle}>{entry.summary}</p>
                  <p className={styles.timelineMeta}>{entry.location}</p>
                </div>
                <time className={styles.timelineTime}>{formatAbsolute(entry.timestamp)}</time>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
