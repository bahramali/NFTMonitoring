import React from "react";
import styles from "./Overview.module.css";

const STATUS_LABELS = {
  online: "ONLINE",
  stale: "STALE",
  offline: "OFFLINE",
  error: "ERROR",
};

const STATUS_CLASS_MAP = {
  online: styles.statusOnline,
  stale: styles.statusStale,
  offline: styles.statusOffline,
  error: styles.statusError,
};

export default function DeviceStatusBadge({ status }) {
  const normalized = String(status || "offline").toLowerCase();
  const label = STATUS_LABELS[normalized] || STATUS_LABELS.offline;

  return <span className={`${styles.statusBadge} ${STATUS_CLASS_MAP[normalized] || styles.statusOffline}`}>{label}</span>;
}
