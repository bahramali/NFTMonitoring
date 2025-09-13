// src/pages/Overview/components/Overview.jsx
import React, { useMemo, useState } from "react";
import DeviceCard from "./DeviceCard.jsx";
import LayerCard from "./LayerCard.jsx";
import Stat from "./Stat.jsx";
import styles from "./Overview.module.css";
import { useSensorConfig } from "../../../context/SensorConfigContext.jsx";
import useWaterCompositeCards from "./useWaterCompositeCards.js";
import { useStomp } from "../../../hooks/useStomp";
import Header from "../../common/Header";

// utils
import {
    fmt,
    localDateTime,
    aggregateFromCards,
    sensorLabel,
    normalizeSensors,
} from "../utils";
import isWaterDevice from "../utils/isWaterDevice.js"; // import local to avoid cycles

/* ----------------------------- helpers ----------------------------- */

// Split "S01-L02-G03" into parts
const splitComp = (cid) => {
    const [sys, lay, dev] = String(cid || "").trim().toUpperCase().split("-");
    return { sys, lay, dev };
};

// Safe layer normalizer: returns "L01"/"L02"/... or null (never "--")
const normLayerIdSafe = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return null;

    // Already "Lxx"
    if (/^L\d+$/i.test(s)) return s.toUpperCase();

    // "L 1" / "L1" / "layer1"
    let m = /^L\s*(\d+)$/i.exec(s);
    if (!m) m = /^layer\s*(\d+)$/i.exec(s);
    if (m) return `L${String(m[1]).padStart(2, "0")}`;

    return null;
};

/* ---------------------- build systems & layers ---------------------- */

// Map of metrics -> known key aliases in card.sensors
const WATER_ALIASES = {
    pH: ["pH", "ph"],
    dissolvedOxygen: ["dissolvedOxygen", "do", "do_mgL", "doMgL", "oxygen_mgL"],
    dissolvedEC: ["dissolvedEC", "ec", "ec_mScm", "ec_mS", "ecmScm"],
    dissolvedTDS: ["dissolvedTDS", "tds", "tds_ppm", "tdsPpm"],
    dissolvedTemp: ["dissolvedTemp", "waterTemp", "temp", "tempC", "water_tempC"],
};

// Aggregate water metrics from cards.sensors using aliases above
function aggregateWaterFromCards(cards = []) {
    const sums = { pH: 0, dissolvedOxygen: 0, dissolvedEC: 0, dissolvedTDS: 0, dissolvedTemp: 0 };
    const counts = { pH: 0, dissolvedOxygen: 0, dissolvedEC: 0, dissolvedTDS: 0, dissolvedTemp: 0 };

    const pickVal = (sensors, aliases) => {
        for (const k of aliases) {
            const v = sensors?.[k]?.value;
            if (v != null && !Number.isNaN(Number(v))) return Number(v);
        }
        return null;
    };

    for (const card of cards) {
        const s = card.sensors || {};
        for (const metric of Object.keys(WATER_ALIASES)) {
            const v = pickVal(s, WATER_ALIASES[metric]);
            if (v != null) {
                sums[metric] += v;
                counts[metric] += 1;
            }
        }
    }

    const avg = {};
    for (const m of Object.keys(sums)) {
        avg[m] = counts[m] > 0 ? (sums[m] / counts[m]) : null;
    }
    return { avg, counts };
}

// Build system list and layer ids purely from live sensor topics
function useSystemsIndex() {
    const [index, setIndex] = React.useState({}); // { S01: { id, layers: ["L01","L02"], lastTs } }

    const topics = React.useMemo(() => ["/topic/growSensors", "/topic/waterTank"], []);
    useStomp(topics, (_topic, data) => {
        if (!data) return;

        let cid = data.compositeId || data.composite_id || data.cid;
        let sys, lay;
        if (cid) {
            ({ sys, lay } = splitComp(cid));
        } else {
            sys = String(data.system || data.systemId || "").toUpperCase();
            lay = String(data.layer || data.layerId || "");
        }
        if (!sys) return;

        const ts = Number(data.timestamp || data.ts || Date.now());
        const layerId = normLayerIdSafe(lay);

        setIndex((prev) => {
            const next = { ...prev };
            const cur = next[sys] || { id: sys, layers: [], lastTs: 0 };
            if (layerId && !cur.layers.includes(layerId)) cur.layers.push(layerId);
            cur.lastTs = Math.max(cur.lastTs || 0, ts);
            next[sys] = cur;
            return next;
        });
    });

    // Return as array for UI
    return React.useMemo(() => {
        const arr = Object.values(index).map((item) => ({
            id: item.id,
            name: item.id,
            updatedAt: item.lastTs ? localDateTime(item.lastTs) : "--",
            layers: item.layers.filter(Boolean).map((id) => ({ id, health: "ok" })), // health is cosmetic here
        }));
        arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        return arr;
    }, [index]);
}

/* ---------------- collect all cards for a system ------------------- */

function useSystemCompositeCards(systemKeyInput) {
    const [cards, setCards] = React.useState({});
    const sysKey = String(systemKeyInput || "").toUpperCase();

    const upsert = React.useCallback((compId, sensors, ts) => {
        setCards((prev) => {
            const next = { ...prev };
            const cur = next[compId] || { sensors: {}, ts: 0 };
            const normalized = normalizeSensors(sensors);
            for (const [k, obj] of Object.entries(normalized)) {
                cur.sensors[k] = { value: obj.value, unit: obj.unit };
            }
            cur.ts = Math.max(cur.ts || 0, ts || Date.now());
            next[compId] = cur;
            return next;
        });
    }, []);

    const topics = React.useMemo(() => ["/topic/growSensors", "/topic/waterTank"], []);
    useStomp(topics, (_topic, data) => {
        if (!data) return;

        let cid = data.compositeId || data.composite_id || data.cid;
        if (!cid) {
            const sys = data.system || data.systemId;
            const lay = data.layer || data.layerId;
            const dev = data.deviceId || data.device || data.devId;
            if (sys && lay && dev) cid = `${sys}-${lay}-${dev}`;
        }
        if (!cid) return;

        const { sys } = splitComp(cid);
        if (!sys || sys.toUpperCase() !== sysKey) return;

        const sensors =
            data.sensors ||
            data.values ||
            data.env ||
            data.water ||
            data.payload ||
            data.readings ||
            [];
        upsert(cid, sensors, data.timestamp || data.ts);
    });

    React.useEffect(() => {
        setCards({});
    }, [sysKey]);

    return React.useMemo(
        () =>
            Object.entries(cards)
                .map(([compId, payload]) => ({ compId, ...payload }))
                .sort((a, b) => String(a.compId).localeCompare(String(b.compId))),
        [cards]
    );
}

/* ------------------------------- page ------------------------------- */

export default function Overview() {
    const systems = useSystemsIndex();

    const [activeId, setActiveId] = useState(null);
    const active = systems.find((s) => s.id === activeId) || systems[0] || null;
    const activeIdSafe = active?.id || ""; // always defined for hooks

    // Water: always call hooks (even when data not ready)
    const waterCards = useWaterCompositeCards(activeIdSafe);
    const waterAgg = useMemo(() => aggregateWaterFromCards(waterCards), [waterCards]);

    // Env overview from non-water cards
    const sysCards = useSystemCompositeCards(activeIdSafe);
    const growCards = useMemo(() => sysCards.filter((c) => !isWaterDevice(c.compId)), [sysCards]);
    const envAgg = useMemo(() => aggregateFromCards(growCards), [growCards]);
    const { configs } = useSensorConfig();

    return (
        <div className={styles.page}>
            <Header title="Overview" />
            {(!systems.length || !active) ? (
                <div>Waiting for data…</div>
                ) : (
                <>
            {/* System tabs */}
            <div className={styles.tabs}>
                {systems.map((sys) => (
                    <button
                        key={sys.id}
                        className={`${styles.tab} ${active.id === sys.id ? styles.active : ""}`}
                        onClick={() => setActiveId(sys.id)}
                    >
                        System: {sys.name}
                    </button>
                ))}
            </div>

            <div className={`${styles.card} ${styles.shadow} ${styles.systemCard}`}>
                <div className={styles.muted}>Last update: {active.updatedAt}</div>
                <h2>{active.name}</h2>

                {/* ------------------------- Water summary ------------------------- */}
                <div className={styles.row}>
                    <div className={styles.col6}>
                        <div className={`${styles.subcard} ${styles.water}`}>
                            <h3>Water</h3>

                            <div className={styles.stats}>
                                {WATER_STATS.map(({ label, key, precision, rangeKey }) => {
                                    const count = waterAgg?.counts?.[key] || 0;
                                    const value = fmt(waterAgg?.avg?.[key], precision);
                                    const range = configs[rangeKey]?.idealRange;
                                    return (
                                        <Stat
                                            key={key}
                                            label={`${label}=`}
                                            value={`${value} (${count} sensors)`}
                                            range={range}
                                        />
                                    );
                                })}
                            </div>

                            <div className={styles.divider} />
                            <div className={styles.devCards}>
                                {waterCards.length ? (
                                    waterCards.map((card) => (
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

                <div className={styles.divider} />

                {/* ---------------------- Layers + Env overview -------------------- */}
                <div className={styles.section}>
                    <h3 className={styles.muted}>Layers</h3>

                    {/* Environment overview (aggregated from grow device cards) */}
                    <div className={`${styles.subcard} ${styles.env}`}>
                        <h3>Environment overview</h3>
                        <div className={styles.stats}>
                            {envAgg?.counts?.light > 0 && (
                                <Stat
                                    label="Light="
                                    value={`${fmt(envAgg.avg.light)} lux (${envAgg.counts.light} sensors)`}
                                    range={configs.lux?.idealRange}
                                />
                            )}
                            {envAgg?.counts?.temperature > 0 && (
                                <Stat
                                    label="Temp="
                                    value={`${fmt(envAgg.avg.temperature)} °C (${envAgg.counts.temperature} sensors)`}
                                    range={configs.temperature?.idealRange}
                                />
                            )}
                            {envAgg?.counts?.humidity > 0 && (
                                <Stat
                                    label="Humidity="
                                    value={`${fmt(envAgg.avg.humidity)} % (${envAgg.counts.humidity} sensors)`}
                                    range={configs.humidity?.idealRange}
                                />
                            )}
                            {envAgg?.counts?.co2 > 0 && (
                                <Stat
                                    label="CO₂="
                                    value={`${fmt(envAgg.avg.co2, 0)} ppm (${envAgg.counts.co2} sensors)`}
                                    range={configs.co2?.idealRange}
                                />
                            )}
                        </div>

                        <div className={styles.divider} />

                        <div className={styles.layers}>
                            {active.layers.map((l) => (
                                <LayerCard key={l.id} layer={l} systemId={active.id} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )}
</div>
);
}

/* --------------------------- constants --------------------------- */
// Keys must match normalized sensor keys from utils/normalizeSensors
const WATER_STATS = [
    { label: "pH", key: "pH", precision: 1, rangeKey: "ph" },
    { label: "DO", key: "dissolvedOxygen", precision: 1, rangeKey: "dissolvedOxygen" },
    { label: "EC", key: "dissolvedEC", precision: 2, rangeKey: "ec" },
    { label: "TDS", key: "dissolvedTDS", precision: 0, rangeKey: "tds" },
    { label: "Temp", key: "dissolvedTemp", precision: 1, rangeKey: "temperature" },
];
