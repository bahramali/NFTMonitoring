import React from "react";
import styles from "./Overview.module.css";
import OverviewBox from "./OverviewBox";

/**
 * Overview grid container.
 * Props:
 *  - items: Array<{
 *      key: string;
 *      icon: ReactNode;
 *      value: string | number;
 *      unit?: string;
 *      title: string;
 *      subtitle?: string;
 *      ranges?: { ok?: [number, number]; warn?: [number, number]; danger?: [number, number] };
 *      onClick?: () => void;
 *    }>
 */
export default function Overview({ items = [] }) {
    return (
        <div className={styles.grid}>
            {items.map((it) => (
                <OverviewBox key={it.key} {...it} />
            ))}
        </div>
    );
}