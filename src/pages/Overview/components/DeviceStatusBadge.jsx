import React from "react";
import styles from "./Overview.module.css";

const STATUS_LABELS = {
  ok: "OK",
  degraded: "DEGRADED",
  critical: "CRITICAL",
  offline: "OFFLINE",
};

const STATUS_ICON = {
  ok: "🟢",
  degraded: "🟡",
  critical: "🔴",
  offline: "⚫",
};

const STATUS_CLASS_MAP = {
  ok: styles.statusOk,
  degraded: styles.statusDegraded,
  critical: styles.statusCritical,
  offline: styles.statusOffline,
};

export default function DeviceStatusBadge({ status }) {
  const normalized = String(status || "offline").toLowerCase();
  const label = STATUS_LABELS[normalized] || STATUS_LABELS.offline;
  const icon = STATUS_ICON[normalized] || STATUS_ICON.offline;

  return (
    <span className={`${styles.statusBadge} ${STATUS_CLASS_MAP[normalized] || styles.statusOffline}`}>
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
}
