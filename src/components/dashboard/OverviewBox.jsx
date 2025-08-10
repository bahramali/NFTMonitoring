import React from "react";
import clsx from "clsx";
import styles from "./Overview.module.css";

/**
 * Generic, reusable KPI box.
 * Props:
 *  - icon: ReactNode (top-left)
 *  - value: string | number (big number)
 *  - unit: string (optional, small suffix to the value)
 *  - title: string (bottom caption)
 *  - subtitle: string (tiny caption under title, optional)
 *  - ranges: {
 *      // Define visual state based on value
 *      ok?: [number, number];
 *      warn?: [number, number];
 *      danger?: [number, number];
 *    }
 *  - onClick: () => void (optional)
 */
export default function OverviewBox({
                                        icon,
                                        value,
                                        unit,
                                        title,
                                        subtitle,
                                        ranges,
                                        onClick,
                                    }) {
    // ---- derive state from ranges
    const numeric = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));

    const inRange = (tuple) =>
        Array.isArray(tuple) && tuple.length === 2 &&
        typeof numeric === "number" && !Number.isNaN(numeric) &&
        numeric >= tuple[0] && numeric <= tuple[1];

    let state = "neutral"; // fallback
    if (inRange(ranges?.danger)) state = "danger";
    else if (inRange(ranges?.warn)) state = "warn";
    else if (inRange(ranges?.ok)) state = "ok";

    return (
        <div
            className={clsx(styles.box, styles[state])}
            role={onClick ? "button" : undefined}
            onClick={onClick}
            title={title}
        >
            <div className={styles.boxHeader}>
                <div className={styles.icon}>{icon}</div>
            </div>

            <div className={styles.valueRow}>
                <span className={styles.value}>{value}</span>
                {unit ? <span className={styles.unit}>{unit}</span> : null}
            </div>

            <div className={styles.caption}>
                <div className={styles.title}>{title}</div>
                {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
            </div>
        </div>
    );
}