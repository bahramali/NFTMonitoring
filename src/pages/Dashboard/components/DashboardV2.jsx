// src/pages/Dashboard/DashboardV2.jsx
import React, {useState, useMemo} from "react";
import {useLiveNow} from "../../../hooks/useLiveNow";
import DeviceCard from "./DeviceCard.jsx";
import styles from "./DashboardV2.module.css";
import idealRangeConfig from "../../../idealRangeConfig.js";
import Stat from "./Stat.jsx";
import LayerCard from "./LayerCard.jsx";
import useWaterCompositeCards from "./useWaterCompositeCards.js";
import { fmt, localDateTime, normLayerId, getMetric, getCount, deriveHealth, sensorLabel } from "../utils";
import { isWaterDevice } from "../utils/isWaterDevice.js";

export default function DashboardV2() {
    const live = useLiveNow();
    const systems = useMemo(() => {
        const root = live?.systems;
        if (!root) return [];
        return Object.entries(root).map(([id, sys]) => {
            const water = sys.water || {};
            const env = sys.environment || {};
            const layers = (sys.layers || []).map(l => {
                const layer = {id: normLayerId(l), environment: l?.environment || {}, water: l?.water || {}};
                return {...layer, health: deriveHealth(layer)};
            });
            return {
                id,
                name: sys.systemId ?? id,
                updatedAt: localDateTime(sys.lastUpdate),
                healthy: typeof sys.sensorsHealthy === "number" ? sys.sensorsHealthy : null,
                total: typeof sys.sensorsTotal === "number" ? sys.sensorsTotal : null,
                water,
                env,
                layers
            };
        });
    }, [live]);

    const [activeId, setActiveId] = useState(null);
    const active = systems.find(s => s.id === activeId) || systems[0];
    const waterCards = useWaterCompositeCards(active?.id).filter(card => isWaterDevice(card.compId));
    if (!live) return <div className={styles.page}>Connecting...</div>;
    if (!systems.length) return <div className={styles.page}>No systems</div>;

    return (
        <div className={styles.page}>
            <div className={styles.tabs}>
                {systems.map(sys => (
                    <button key={sys.id} className={`${styles.tab} ${active.id === sys.id ? styles.active : ""}`}
                            onClick={() => setActiveId(sys.id)}>System: {sys.name}</button>
                ))}
            </div>

            <div className={`${styles.card} ${styles.shadow} ${styles.systemCard}`}>
                <div className={styles.muted}>Last update: {active.updatedAt}</div>
                <h2>{active.name}</h2>
                <div className={styles.stats} style={{marginBottom: 8}}>
                    {active.healthy != null && active.total != null && (
                        <Stat label="Healthy sensors / total" value={`${active.healthy} / ${active.total}`}/>)}
                </div>
                <div className={styles.row}>
                    <div className={styles.col6}>
                        <div className={`${styles.subcard} ${styles.water}`}>
                            <h3>Water</h3>
                            <div className={styles.stats}>
                                {WATER_STATS.map(({label, key, alt, precision, rangeKey}) => {
                                    const count = getCount(active.water, key) + (alt ? getCount(active.water, alt) : 0);
                                    const value = fmt(
                                        getMetric(active.water, key) ?? (alt ? getMetric(active.water, alt) : null),
                                        precision
                                    );
                                    const range = idealRangeConfig[rangeKey]?.idealRange;
                                    return (
                                        <Stat key={key} label={`${label}=`} value={`${value} (${count} sensors)`} range={range}/>
                                    );
                                })}
                            </div>
                            <div className={styles.divider}/>
                            <div className={styles.devCards}>
                                {waterCards.length ? (
                                    waterCards.map(card => (
                                        <DeviceCard
                                            key={card.compId}
                                            compositeId={card.compId}
                                            sensors={Object.entries(card.sensors).map(([k, v]) => ({
                                                sensorType: sensorLabel(k),
                                                value: fmt(v?.value),
                                                unit: v?.unit || "",
                                            }))}
                                        />
                                    ))
                                ) : (
                                    <div className={styles.muted}>No device cards</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.divider}/>
                <div className={styles.section}>
                    <h3 className={styles.muted}>Layers</h3>
                    <div className={`${styles.subcard} ${styles.env}`}>
                        <h3>Environment overview</h3>
                        <div className={styles.stats}>
                            {ENV_STATS.map(({label, key, precision, rangeKey}) => (
                                <Stat
                                    key={key}
                                    label={`${label}=`}
                                    value={`${fmt(getMetric(active.env, key), precision)} (${getCount(active.env, key)} sensors)`}
                                    range={idealRangeConfig[rangeKey]?.idealRange}
                                />
                            ))}
                        </div>
                        <div className={styles.divider}/>
                        <div className={styles.layers}>
                            {active.layers.map(l => (<LayerCard key={l.id} layer={l} systemId={active.id}/>))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

const WATER_STATS = [
    {label: "pH", key: "pH", alt: "ph", precision: 1, rangeKey: "ph"},
    {label: "DO", key: "dissolvedOxygen", precision: 1, rangeKey: "dissolvedOxygen"},
    {label: "EC", key: "dissolvedEC", precision: 2, rangeKey: "ec"},
    {label: "TDS", key: "dissolvedTDS", precision: 0, rangeKey: "tds"},
    {label: "Temp", key: "dissolvedTemp", precision: 1, rangeKey: "temperature"},
];

const ENV_STATS = [
    {label: "Light", key: "light", precision: 1, rangeKey: "lux"},
    {label: "Temp", key: "temperature", precision: 1, rangeKey: "temperature"},
    {label: "Humidity", key: "humidity", precision: 0, rangeKey: "humidity"},
    {label: "CO₂", key: "co2", precision: 0},
];
