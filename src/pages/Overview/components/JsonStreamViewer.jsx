import React, { useMemo, useState } from "react";
import styles from "./Overview.module.css";

const TAB_OPTIONS = ["all", "telemetry", "status", "event"];

const formatTime = (value) => {
  if (!value) return "-";
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (Number.isNaN(parsed)) return "-";
  return new Date(parsed).toLocaleString();
};

export default function JsonStreamViewer({
  device,
  isOpen,
  messages,
  paused,
  onPauseToggle,
  onClear,
  onClose,
}) {
  const [tab, setTab] = useState("all");

  const filteredMessages = useMemo(() => {
    if (tab === "all") return messages;
    return messages.filter((message) => message.kind === tab);
  }, [messages, tab]);

  const handleCopy = async () => {
    const text = filteredMessages.map((entry) => JSON.stringify(entry.raw)).join("\n");
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    const lines = filteredMessages.map((entry) => JSON.stringify(entry.raw)).join("\n");
    const blob = new Blob([lines], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `device-stream-${device?.deviceId || "unknown"}.jsonl`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !device) return null;

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <aside className={styles.modalPanel} role="dialog" onClick={(event) => event.stopPropagation()}>
        <header className={styles.modalHeader}>
          <div>
            <h3>Live JSON Stream</h3>
            <p>
              {device.farmId} / {device.unitType} / {device.unitId} / {device.layerId || "-"} / {device.deviceId}
            </p>
          </div>
          <button type="button" onClick={onClose} className={styles.secondaryButton}>
            Close
          </button>
        </header>

        <div className={styles.tabs}>
          {TAB_OPTIONS.map((option) => (
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

        <div className={styles.actionsRow}>
          <button type="button" onClick={onPauseToggle} className={styles.primaryButton}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={onClear} className={styles.secondaryButton}>
            Clear
          </button>
          <button type="button" onClick={handleCopy} className={styles.secondaryButton}>
            Copy JSON
          </button>
          <button type="button" onClick={handleDownload} className={styles.secondaryButton}>
            Download .jsonl
          </button>
        </div>

        <div className={styles.streamContainer}>
          {filteredMessages.length === 0 ? <p>No messages yet.</p> : null}
          {filteredMessages.map((entry) => (
            <details key={entry.id} className={styles.messageCard} open>
              <summary>
                <span>{entry.kind || "unknown"}</span>
                <span>{formatTime(entry.timestamp || entry.receivedAt)}</span>
              </summary>
              <pre>{JSON.stringify(entry.raw, null, 2)}</pre>
            </details>
          ))}
        </div>
      </aside>
    </div>
  );
}
