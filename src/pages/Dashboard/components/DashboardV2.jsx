// src/pages/Dashboard/DashboardV2.jsx
import React, {useState, useMemo} from "react";
import {useLiveNow} from "../../../hooks/useLiveNow";
import {useStomp} from "../../../hooks/useStomp";
import DeviceCard from "./DeviceCard.jsx";
import styles from "./DashboardV2.module.css";
import idealRangeConfig from "../../../idealRangeConfig.js";
import clsx from "clsx";
import { normalizeSensors } from "../../../utils/normalizeSensors.js";

// ---------- utils ----------
const toNum = (v) => (v == null || v === "" ? null : Number(v));
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? "--" : Number(v).toFixed(d));
const localDateTime = (ms) => {
    try {
        return ms ? new Date(ms).toLocaleString() : "--";
    } catch {
        return "--";
    }
};
const normLayerId = (l) => {
    const raw = l?.id ?? l?.layerId ?? "";
    if (/^L\d+$/i.test(raw)) return raw.toUpperCase();
    const m = /^layer(\d+)$/i.exec(raw || "");
    return m ? `L${String(m[1]).padStart(2, "0")}` : (raw || "--");
};

function getMetric(obj, key) {
    if (!obj) return null;
    const val = obj[key] ?? obj[key?.toLowerCase()] ?? obj[key?.toUpperCase()];
    if (val == null) return null;
    return typeof val === "object" ? toNum(val.average ?? val.avg ?? val.value) : toNum(val);
}

function getCount(obj, key) {
    if (!obj) return 0;
    const v = obj[key] ?? obj[key?.toLowerCase()] ?? obj[key?.toUpperCase()];
    if (v && typeof v === "object") {
        const n = v.deviceCount ?? v.count ?? v.sensorCount;
        return typeof n === "number" ? n : 0;
    }
    return v != null ? 1 : 0;
}

function deriveHealth(layer) {
    const e = layer.environment || {};
    const present = ["light", "temperature", "humidity"].map(k => getMetric(e, k)).filter(v => v != null).length;
    return present === 0 ? "down" : present < 3 ? "warn" : "ok";
}

// websocket sensor key mapping
const sensorLabel = (k) => ({
    light: "Light",
    temperature: "Temp",
    humidity: "Humidity",
    pH: "pH",
    dissolvedTemp: "Water Temp",
    dissolvedOxygen: "DO",
    dissolvedEC: "EC",
    dissolvedTDS: "TDS"
}[k] || k);

// ---------- small UI pieces ----------
function aggregateFromCards(cards) {
  const keys = ["light", "temperature", "humidity", "pH", "co2"]; // ← co2 اضافه شد
  const sums = {}, counts = {};
    for (const c of cards || []) {
        const s = c?.sensors || {};
        for (const k of keys) {
            const v = s[k]?.value;
            const n = v == null ? null : Number(v);
            if (n != null && !Number.isNaN(n)) {
                sums[k] = (sums[k] || 0) + n;
                counts[k] = (counts[k] || 0) + 1;
            }
        }
    }
    const avg = {};
  Object.keys(sums).forEach(k => (avg[k] = sums[k] / counts[k]));
    return {avg, counts};
}

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
            <strong>{value}</strong>
            <span className={styles.muted}>{label}</span>
        </div>
    );
}

function MetricLine({label, value, count, unit}) {
    return (<div className={styles.kv}>
        <span>{label}</span><b>{fmt(value)} {unit} {count > 0 ? `(${count} sensors)` : ""}</b></div>);
}

// metric configs used to render sensor stats
const WATER_STATS = [
    {label: "pH", key: "pH", alt: "ph", precision: 1, rangeKey: "ph"},
    {label: "DO", key: "dissolvedOxygen", precision: 1, rangeKey: "dissolvedOxygen"},
    {label: "EC", key: "dissolvedEC", precision: 2, rangeKey: "ec"},
    {label: "TDS", key: "dissolvedTDS", precision: 0, rangeKey: "tds"},
    {label: "Temp", key: "dissolvedTemp", precision: 1, rangeKey: "temperature"}
];

const ENV_STATS = [
    {label: "Light", key: "light", precision: 1, rangeKey: "lux"},
    {label: "Temp", key: "temperature", precision: 1, rangeKey: "temperature"},
    {label: "Humidity", key: "humidity", precision: 0, rangeKey: "humidity"},
    {label: "CO₂", key: "co2", precision: 0}
];

// identify water sensors by device id starting with 'T'
// eslint-disable-next-line react-refresh/only-export-components
export function isWaterDevice(compId) {
    const parts = String(compId || "").trim().toUpperCase().split("-");
    return parts[2]?.startsWith("T") || false;
}

// subscribe to websockets and build composite cards per layer
function useLayerCompositeCards(systemKeyInput, layerId) {
    const [cards, setCards] = React.useState({});
    const layerKey = String(layerId || "").toUpperCase();
    const sysKey = String(systemKeyInput || "").toUpperCase();

    const isMine = React.useCallback((compId, data) => {
        const cid = String(compId || "").trim().toUpperCase();
        if (cid) {
            if (!cid.startsWith(`${sysKey}-`)) return false;
            if (!cid.includes(`-${layerKey}-`)) return false;
            return true;
        }
        const sys = String(data?.system || data?.systemId || "").trim().toUpperCase();
        const lay = String(data?.layer || data?.layerId || "").trim().toUpperCase();
        if (sysKey && sys && sys !== sysKey) return false;
        if (layerKey && lay && lay !== layerKey) return false;
        return !!sys && !!lay;
    }, [sysKey, layerKey]);

    const upsert = React.useCallback((compId, sensors, ts) => {
        setCards(prev => {
            const next = {...prev};
            const cur = next[compId] || {sensors: {}, ts: 0};
            const normalized = normalizeSensors(sensors);
            for (const [k, obj] of Object.entries(normalized)) {
                cur.sensors[k] = {value: obj.value, unit: obj.unit};
            }
            cur.ts = Math.max(cur.ts || 0, ts || Date.now());
            next[compId] = cur;
            return next;
        });
    }, []);

    const topics = React.useMemo(() => ["/topic/growSensors", "/topic/waterTank"], []); // stable reference
    useStomp(topics, (topic, data) => {
        if (!data) return;
        let compId = data.compositeId || data.composite_id || data.cid;
        if (!compId) {
            const sys = data.system || data.systemId;
            const lay = data.layer || data.layerId;
            const dev = data.deviceId || data.device || data.devId;
            if (sys && lay && dev) compId = `${sys}-${lay}-${dev}`;
        }
        if (!compId) return;
        if (!isMine(compId, data)) return;
        const sensors = data.sensors || data.values || data.env || data.water || data.payload || data.readings || [];
        upsert(compId, sensors, data.timestamp || data.ts);
    });

    React.useEffect(() => {
        setCards({});
    }, [sysKey, layerKey]);

    return React.useMemo(() => Object.entries(cards).map(([compId, payload]) => ({compId, ...payload})).sort((a, b) => String(a.compId).localeCompare(String(b.compId))), [cards]);
}

// collect water-sensor device cards for a system
function useWaterCompositeCards(systemKeyInput) {
    const [cards, setCards] = React.useState({});
    const sysKey = String(systemKeyInput || "").toUpperCase();

    const isMine = React.useCallback((compId, data) => {
        const cid = String(compId || "").trim().toUpperCase();
        if (cid) {
            if (!cid.startsWith(`${sysKey}-`)) return false;
            if (!isWaterDevice(cid)) return false;
            return true;
        }
        const sys = String(data?.system || data?.systemId || "").trim().toUpperCase();
        const dev = String(data?.deviceId || data?.device || data?.devId || "").trim().toUpperCase();
        if (sysKey && sys && sys !== sysKey) return false;
        return !!sys && dev.startsWith("T");
    }, [sysKey]);

    const upsert = React.useCallback((compId, sensors, ts) => {
        setCards(prev => {
            const next = {...prev};
            const cur = next[compId] || {sensors: {}, ts: 0};
            const normalized = normalizeSensors(sensors);
            for (const [k, obj] of Object.entries(normalized)) {
                cur.sensors[k] = {value: obj.value, unit: obj.unit};
            }
            cur.ts = Math.max(cur.ts || 0, ts || Date.now());
            next[compId] = cur;
            return next;
        });
    }, []);

    const topics = React.useMemo(() => ["/topic/growSensors", "/topic/waterTank"], []);
    useStomp(topics, (topic, data) => {
        if (!data) return;
        let compId = data.compositeId || data.composite_id || data.cid;
        if (!compId) {
            const sys = data.system || data.systemId;
            const lay = data.layer || data.layerId;
            const dev = data.deviceId || data.device || data.devId;
            if (sys && lay && dev) compId = `${sys}-${lay}-${dev}`;
        }
        if (!compId) return;
        if (!isMine(compId, data)) return;
        const sensors = data.sensors || data.values || data.env || data.water || data.payload || data.readings || [];
        upsert(compId, sensors, data.timestamp || data.ts);
    });

    React.useEffect(() => { setCards({}); }, [sysKey]);

    return React.useMemo(() => Object.entries(cards).map(([compId, payload]) => ({compId, ...payload})).sort((a,b) => String(a.compId).localeCompare(String(b.compId))), [cards]);
}

function LayerCard({layer, systemId}) {
    // build device cards for this system/layer
    const deviceCards = useLayerCompositeCards(systemId, layer.id).filter(card => !isWaterDevice(card.compId));
    const agg = React.useMemo(() => aggregateFromCards(deviceCards), [deviceCards]);

    return (
        <div className={`${styles.card} ${styles.layer}`}>
            <div className={styles.headerRow}>
                <h4>
                    {layer.id} <span className={`${styles.dot} ${styles[layer.health]}`}/>
                </h4>
            </div>

            {/* always-visible summary as chips */}
            <div className={styles.stats}>
                {agg.counts.light > 0 && (
                    <Stat
                        label={`Light (${agg.counts.light} sensors)`}
                        value={`${fmt(agg.avg.light)} lux`}
                        range={idealRangeConfig.lux?.idealRange}
                    />
                )}
                {agg.counts.temperature > 0 && (
                    <Stat
                        label={`Temp (${agg.counts.temperature} sensors)`}
                        value={`${fmt(agg.avg.temperature)} °C`}
                        range={idealRangeConfig.temperature?.idealRange}
                    />
                )}
                {agg.counts.humidity > 0 && (
                    <Stat
                        label={`Humidity (${agg.counts.humidity} sensors)`}
                        value={`${fmt(agg.avg.humidity)} %`}
                        range={idealRangeConfig.humidity?.idealRange}
                    />
                )}
                {agg.counts.pH > 0 && (
                    <Stat
                        label={`pH (${agg.counts.pH} sensors)`}
                        value={`${fmt(agg.avg.pH)}`}
                        range={idealRangeConfig.ph?.idealRange}
                    />
                )}
                {agg.counts.co2 > 0 && (
                    <Stat
                        label={`CO₂ (${agg.counts.co2} sensors)`}
                        value={`${fmt(agg.avg.co2, 0)} ppm`}
                        // range نداریم، می‌تونی اگر داشتی بدی
                    />
                )}
            </div>


            <div className={styles.details}>
                <div className={styles.devCards}>
                    {deviceCards.length ? (
                        deviceCards.map((card) => (
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
    );
}

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
    const waterCards = useWaterCompositeCards(active?.id);
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
                    {/*<Stat label="Layers" value={active.layers.length}/>*/}
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
                                        <Stat key={key} label={`${label} (${count} sensors)`} value={value} range={range}/>
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
                                    label={`${label} (${getCount(active.env, key)} sensors)`}
                                    value={fmt(getMetric(active.env, key), precision)}
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