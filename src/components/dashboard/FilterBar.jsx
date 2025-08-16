import React from "react";
import styles from "./FilterBar.module.css";

export default function FilterBar({ systems = [], selected = {}, onToggle }) {
    return (
        <div className={styles.bar}>
            {systems.flatMap((sys) =>
                (sys._layerCards || []).map((layer) => {
                    const sysId = sys.systemId;
                    const layerId = layer.id;
                    const label = `${sysId}-${layerId}`;
                    const checked = selected?.[sysId]?.[layerId] ?? true;
                    return (
                        <label key={label} className={styles.item}>
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggle && onToggle(sysId, layerId)}
                            />
                            {label}
                        </label>
                    );
                })
            )}
        </div>
    );
}

