import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../common/Header";
import { useHallInventory } from "./useHallInventory.js";
import styles from "./Hall.module.css";

const formatTimestamp = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
};

const sortByNumericSuffix = (a, b) => {
    const numA = Number(String(a).replace(/\D/g, ""));
    const numB = Number(String(b).replace(/\D/g, ""));
    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
        return numA - numB;
    }
    return String(a).localeCompare(String(b));
};

export default function HallPage() {
    const navigate = useNavigate();
    const { inventory, unmappedCount, fallbackStatus } = useHallInventory();

    const rackCards = useMemo(() => {
        return Array.from(inventory.racks.entries())
            .map(([rackId, data]) => {
                const layers = Array.from(data.layers).sort(sortByNumericSuffix);
                return {
                    rackId,
                    layers,
                    counts: data.deviceCounts,
                    lastUpdate: data.lastUpdate,
                };
            })
            .sort((a, b) => sortByNumericSuffix(a.rackId, b.rackId));
    }, [inventory.racks]);

    return (
        <div className={styles.page}>
            <Header title="Hall" />

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>Racks</div>
                    {fallbackStatus.loading && <div className={styles.subtleText}>Loading inventory…</div>}
                </div>

                {rackCards.length === 0 ? (
                    <div className={styles.emptyState}>No racks discovered yet.</div>
                ) : (
                    <div className={styles.cardGrid}>
                        {rackCards.map((rack) => (
                            <article key={rack.rackId} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardTitle}>Rack {rack.rackId}</div>
                                    <div className={styles.subtleText}>{formatTimestamp(rack.lastUpdate)}</div>
                                </div>

                                <div className={styles.countRow}>
                                    <span>C:{rack.counts.C ?? 0}</span>
                                    <span>T:{rack.counts.T ?? 0}</span>
                                    <span>R:{rack.counts.R ?? 0}</span>
                                </div>

                                <div className={styles.layerChips}>
                                    {rack.layers.map((layerId) => (
                                        <button
                                            key={layerId}
                                            type="button"
                                            className={styles.chipButton}
                                            onClick={() => navigate(`/monitoring/hall/racks/${rack.rackId}/layers/${layerId}`)}
                                        >
                                            {layerId}
                                        </button>
                                    ))}
                                </div>

                                <div className={styles.actionRow}>
                                    <button
                                        type="button"
                                        className={styles.actionButton}
                                        onClick={() => navigate(`/monitoring/hall/racks/${rack.rackId}`)}
                                    >
                                        Open Rack
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {unmappedCount > 0 && (
                    <div className={styles.warning}>Unmapped devices detected: {unmappedCount}</div>
                )}
                {fallbackStatus.error && <div className={styles.warning}>{fallbackStatus.error}</div>}
            </section>
        </div>
    );
}
