import React from "react";
import clsx from "clsx";
import styles from "./Stat.module.css";

function Stat({label, value, range}) {
  const numeric = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  let state = null;
  if (range && typeof numeric === "number" && !Number.isNaN(numeric)) {
    const {min, max} = range;
    if (typeof min === "number" && typeof max === "number") {
      const threshold = (max - min) * 0.1;
      if (numeric < min || numeric > max) state = "danger";
      else if (numeric < min + threshold || numeric > max - threshold) state = "warn";
      else state = "ok";
    }
  }
  return (
    <div
      className={clsx(
        styles.stat,
        state === "ok" && styles.statOk,
        state === "warn" && styles.statWarn,
        state === "danger" && styles.statDanger
      )}
    >
      <span className={styles.muted}>{label}</span>{" "}
      <strong>{value}</strong>
    </div>
  );
}

export default React.memo(Stat);
