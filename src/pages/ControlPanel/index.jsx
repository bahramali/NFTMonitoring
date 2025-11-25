import React, { useMemo, useState } from "react";
import Header from "../common/Header";
import styles from "./ControlPanel.module.css";

const minutesAgo = (mins) => new Date(Date.now() - mins * 60 * 1000);

const initialZones = [
    {
        id: "grow-room-a",
        name: "Grow Room A",
        fixtures: 6,
        intensity: 82,
        isOn: true,
        lastUpdated: minutesAgo(12),
    },
    {
        id: "grow-room-b",
        name: "Grow Room B",
        fixtures: 5,
        intensity: 76,
        isOn: true,
        lastUpdated: minutesAgo(5),
    },
    {
        id: "flowering-bay",
        name: "Flowering Bay",
        fixtures: 4,
        intensity: 91,
        isOn: true,
        lastUpdated: minutesAgo(18),
    },
    {
        id: "propagation",
        name: "Propagation Lab",
        fixtures: 3,
        intensity: 24,
        isOn: false,
        lastUpdated: minutesAgo(34),
    },
    {
        id: "support",
        name: "Support Corridor",
        fixtures: 2,
        intensity: 0,
        isOn: false,
        lastUpdated: minutesAgo(47),
    },
];

const formatRelativeTime = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    const diff = Date.now() - date.getTime();

    if (Number.isNaN(diff)) {
        return "Unknown";
    }

    const thresholds = [
        { limit: 60 * 1000, divisor: 1000, unit: "second" },
        { limit: 60 * 60 * 1000, divisor: 60 * 1000, unit: "minute" },
        { limit: 24 * 60 * 60 * 1000, divisor: 60 * 60 * 1000, unit: "hour" },
    ];

    for (const { limit, divisor, unit } of thresholds) {
        if (diff < limit) {
            const value = Math.max(1, Math.round(diff / divisor));
            return `${value} ${unit}${value > 1 ? "s" : ""} ago`;
        }
    }

    const days = Math.max(1, Math.round(diff / (24 * 60 * 60 * 1000)));
    return `${days} day${days > 1 ? "s" : ""} ago`;
};

function ControlPanel() {
    const [zones, setZones] = useState(initialZones);

    const lightsOn = useMemo(() => zones.filter((zone) => zone.isOn).length, [zones]);
    const fixturesOn = useMemo(
        () => zones.filter((zone) => zone.isOn).reduce((sum, zone) => sum + zone.fixtures, 0),
        [zones]
    );
    const fixturesTotal = useMemo(() => zones.reduce((sum, zone) => sum + zone.fixtures, 0), [zones]);

    const toggleZone = (id) => {
        setZones((prev) =>
            prev.map((zone) => {
                if (zone.id !== id) return zone;
                const isOn = !zone.isOn;
                return {
                    ...zone,
                    isOn,
                    intensity: isOn ? Math.max(zone.intensity, 20) : 0,
                    lastUpdated: new Date(),
                };
            })
        );
    };

    const updateIntensity = (id, value) => {
        const next = Math.max(0, Math.min(100, Number.parseInt(value, 10) || 0));
        setZones((prev) =>
            prev.map((zone) =>
                zone.id === id
                    ? {
                          ...zone,
                          intensity: next,
                          isOn: next > 0,
                          lastUpdated: new Date(),
                      }
                    : zone
            )
        );
    };

    const setAllZones = (state) => {
        setZones((prev) =>
            prev.map((zone) => ({
                ...zone,
                isOn: state,
                intensity: state ? Math.max(zone.intensity, 60) : 0,
                lastUpdated: new Date(),
            }))
        );
    };

    return (
        <div className={styles.page}>
            <Header title="Control Panel" />

            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <h2 className={styles.heroTitle}>Lighting shortcuts</h2>
                    <p className={styles.heroDescription}>
                        Switch zones on or off instantly and set their brightness without extra forms or MQTT controls.
                    </p>
                    <div className={styles.heroStats}>
                        <span>
                            {lightsOn} of {zones.length} zones are lit
                        </span>
                        <span>
                            {fixturesOn} of {fixturesTotal} fixtures are active
                        </span>
                    </div>
                </div>

                <div className={styles.quickButtons}>
                    <button type="button" className={`${styles.pill} ${styles.pillPrimary}`} onClick={() => setAllZones(true)}>
                        Turn all lights on
                    </button>
                    <button type="button" className={`${styles.pill} ${styles.pillDanger}`} onClick={() => setAllZones(false)}>
                        Turn all lights off
                    </button>
                </div>
            </section>

            <section className={styles.grid}>
                {zones.map((zone) => (
                    <article key={zone.id} className={styles.card}>
                        <header className={styles.cardHeader}>
                            <div>
                                <h3 className={styles.cardTitle}>{zone.name}</h3>
                                <div className={styles.cardMeta}>{zone.fixtures} fixtures</div>
                            </div>
                            <span className={`${styles.status} ${zone.isOn ? styles.statusOn : styles.statusOff}`}>
                                {zone.isOn ? "On" : "Off"}
                            </span>
                        </header>

                        <div className={styles.sliderRow}>
                            <div className={styles.sliderLabel}>Intensity</div>
                            <div className={styles.sliderControl}>
                                <input
                                    className={styles.slider}
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={zone.intensity}
                                    onChange={(e) => updateIntensity(zone.id, e.target.value)}
                                />
                                <div className={styles.sliderValue}>{zone.intensity}%</div>
                            </div>
                        </div>

                        <div className={styles.cardActions}>
                            <button
                                type="button"
                                className={`${styles.toggle} ${zone.isOn ? "" : styles.toggleOff}`}
                                onClick={() => toggleZone(zone.id)}
                            >
                                {zone.isOn ? "Turn off" : "Turn on"}
                            </button>
                            <div className={styles.timestamp}>Updated {formatRelativeTime(zone.lastUpdated)}</div>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}

export default ControlPanel;
