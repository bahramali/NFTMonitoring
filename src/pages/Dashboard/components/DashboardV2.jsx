// src/pages/Dashboard/DashboardV2.jsx
import React, { useState, useMemo } from "react";
import { useLiveNow } from "../../../hooks/useLiveNow";
import { useStomp } from "../../../hooks/useStomp";
import styles from "./DashboardV2.module.css";

// ---------- utils ----------
const toNum = (v) => (v == null || v === "" ? null : Number(v));
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? "--" : Number(v).toFixed(d));
const localDateTime = (ms) => {
  try { return ms ? new Date(ms).toLocaleString() : "--"; } catch { return "--"; }
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
  const present = ["light", "temperature", "humidity"].map((k) => getMetric(e, k)).filter((v) => v != null).length;
  return present === 0 ? "down" : present < 3 ? "warn" : "ok";
}

// map raw keys coming from websocket to canonical keys
function canonKey(raw){
    const t = String(raw || "").toLowerCase();
    if (!t) return null;
    if (t === "light") return "light";
    if (t === "temperature" || t === "temp") return "temperature";
    if (t === "humidity" || t === "hum") return "humidity";
    if (t === "ph") return "pH";
    if (t === "do" || t === "dissolvedoxygen") return "dissolvedOxygen";
    if (t === "ec" || t === "dissolvedec") return "dissolvedEC";
    if (t === "tds" || t === "dissolvedtds") return "dissolvedTDS";
    if (t === "watertemp" || t === "dissolvedtemp") return "dissolvedTemp";
    return raw;
}
function normalizeSensors(src){
    const out = {};
    if (!src) return out;
    if (Array.isArray(src)){
        for (const s of src){
            const k = canonKey(s?.sensorType ?? s?.type ?? s?.name);
            const val = toNum(s?.value);
            const unit = s?.unit || s?.units || s?.u;
            if (k && val != null) out[k] = { value: val, unit };
        }
        return out;
    }
    if (typeof src === "object"){
        for (const [k,v] of Object.entries(src)){
            const key = canonKey(k);
            if (v && typeof v === "object"){
                const val = toNum(v.value ?? v.avg ?? v.average ?? v.v);
                const unit = v.unit || v.u;
                if (val != null) out[key] = { value: val, unit };
            } else if (v != null){
                out[key] = { value: toNum(v) };
            }
        }
    }
    return out;
}
const sensorLabel = (k) => ({
    light: "Light",
    temperature: "Temp",
    humidity: "Humidity",
    pH: "pH",
    dissolvedTemp: "Water Temp",
    dissolvedOxygen: "DO",
    dissolvedEC: "EC",
    dissolvedTDS: "TDS",
}[k] || k);

// ---------- small UI pieces ----------
function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <strong>{value}</strong>
      <span className={styles.muted}>{label}</span>
    </div>
  );
}
function MetricLine({ label, value, count, unit }) {
  return (
    <div className={styles.kv}>
      <span>{label}</span>
      <b>
        {fmt(value)} {unit} {count > 0 ? `(${count} sensors)` : ""}
      </b>
    </div>
  );
}

// subscribe to websockets and build composite cards per layer
function useLayerCompositeCards(systemId, layerId) {
  const [cards, setCards] = React.useState({});
    const layerKey = String(layerId || "").toUpperCase();
    const sysKey = String(systemId || "");

    const isMine = React.useCallback((compId, data) => {
        if (!compId) return false;
        if (sysKey && !String(compId).startsWith(sysKey)) return false;
        if (layerKey && !String(compId).includes(`-${layerKey}-`)) {
            const lay = (data?.layer || data?.layerId || "").toUpperCase();
            if (lay && lay !== layerKey) return false;
        }
        return true;
    }, [sysKey, layerKey]);

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

  // subscribe via useStomp hook (expects topics array and handler)
  useStomp(["/topic/growSensors", "/topic/waterTank"], (topic, data) => {
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

    return React.useMemo(() =>
            Object.entries(cards)
                .map(([compId, payload]) => ({ compId, ...payload }))
                .sort((a, b) => String(a.compId).localeCompare(String(b.compId))),
        [cards]
    );
}

function LayerCard({ layer, systemId }) {
    const [open, setOpen] = useState(false);
    const e = layer.environment || {};

    const lux = getMetric(e, "light");
    const et = getMetric(e, "temperature");
    const hum = getMetric(e, "humidity");
    const ph = getMetric(layer.water, "pH") ?? getMetric(layer.water, "ph");
  const deviceCards = useLayerCompositeCards(systemId, layer.id);

    return (
        <div className={`${styles.card} ${styles.layer}`}>
            <div className={styles.headerRow} onClick={() => setOpen(!open)}>
                <h4>
                    {layer.id} <span className={`${styles.dot} ${styles[layer.health]}`} />
                </h4>
            </div>

      {!open && (
                <>
                    <MetricLine label="Light" value={lux} unit="lux" count={getCount(e,"light")} />
                    <MetricLine label="Temp" value={et} unit="°C" count={getCount(e,"temperature")} />
                    <MetricLine label="Humidity" value={hum} unit="%" count={getCount(e,"humidity")} />
                    <MetricLine label="pH" value={ph} unit="" count={getCount(layer.water,"pH")+getCount(layer.water,"ph")} />
                </>
            )}

      {open && (
                <div className={styles.details}>
                    <div className={styles.devCards}>
                        {deviceCards.length ? (
                            deviceCards.map((card) => (
                                <div key={card.compId} className={styles.devCard}>
                                    <div className={styles.devTitle}>{card.compId}</div>
                                    <ul className={styles.devList}>
                                        {Object.entries(card.sensors).map(([k, v]) => (
                                            <li key={k}>
                                                <span>{sensorLabel(k)}</span>
                                                <b>{fmt(v?.value)} {v?.unit || ""}</b>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                        ) : (
                            <div className={styles.muted}>No device cards</div>
                        )}
                    </div>
                </div>
            )}
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
            const layers = (sys.layers || []).map((l) => {
        const layer = { id: normLayerId(l), environment: l?.environment || {}, water: l?.water || {} };
        return { ...layer, health: deriveHealth(layer) };
            });

            return {
                id,
                name: sys.systemId ?? id,
                updatedAt: localDateTime(sys.lastUpdate),
                healthy: typeof sys.sensorsHealthy === "number" ? sys.sensorsHealthy : null,
                total: typeof sys.sensorsTotal === "number" ? sys.sensorsTotal : null,
                water,
                env,
                layers,
            };
        });
    }, [live]);

    const [activeId, setActiveId] = useState(null);
    if (!live) return <div className={styles.page}>Connecting...</div>;
    if (!systems.length) return <div className={styles.page}>No systems</div>;

    const active = systems.find((s) => s.id === activeId) || systems[0];

    return (
        <div className={styles.page}>
            {/* tabs */}
            <div className={styles.tabs}>
                {systems.map((sys) => (
                    <button
                        key={sys.id}
                        className={`${styles.tab} ${active.id === sys.id ? styles.active : ""}`}
                        onClick={() => setActiveId(sys.id)}
                    >
                        {sys.name}
                    </button>
                ))}
            </div>

            {/* System card (header + water + environment) */}
            <div className={`${styles.card} ${styles.shadow} ${styles.systemCard}`}>
                <h2>{active.name}</h2>
                <div className={styles.muted}>Last update: {active.updatedAt}</div>
                <div className={styles.stats} style={{ marginBottom: 8 }}>
                    {active.healthy != null && active.total != null && (
                        <Stat label="Healthy sensors / total" value={`${active.healthy} / ${active.total}`} />
                    )}
                    <Stat label="Layers" value={active.layers.length} />
                </div>

                <div className={styles.divider} />

                <div className={styles.row}>
                    <div className={styles.col6}>
            <div className={`${styles.subcard} ${styles.water}`}>
                            <h3>Water</h3>
                            <div className={styles.stats}>
                                <Stat label={`pH (${getCount(active.water,"pH")+getCount(active.water,"ph")} sensors)`} value={fmt(getMetric(active.water,"pH")??getMetric(active.water,"ph"),1)} />
                                <Stat label={`DO (${getCount(active.water,"dissolvedOxygen")} sensors)`} value={fmt(getMetric(active.water,"dissolvedOxygen"),1)} />
                                <Stat label={`EC (${getCount(active.water,"dissolvedEC")} sensors)`} value={fmt(getMetric(active.water,"dissolvedEC"),2)} />
                                <Stat label={`TDS (${getCount(active.water,"dissolvedTDS")} sensors)`} value={fmt(getMetric(active.water,"dissolvedTDS"),0)} />
                                <Stat label={`Temp (${getCount(active.water,"dissolvedTemp")} sensors)`} value={fmt(getMetric(active.water,"dissolvedTemp"),1)} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.col6}>
            <div className={`${styles.subcard} ${styles.env}`}>
                            <h3>Environment</h3>
                            <div className={styles.stats}>
                                <Stat label={`Light (${getCount(active.env,"light")} sensors)`} value={fmt(getMetric(active.env,"light"),1)} />
                                <Stat label={`Temp (${getCount(active.env,"temperature")} sensors)`} value={fmt(getMetric(active.env,"temperature"),1)} />
                                <Stat label={`Humidity (${getCount(active.env,"humidity")} sensors)`} value={fmt(getMetric(active.env,"humidity"),0)} />
                                <Stat label={`CO₂ (${getCount(active.env,"co2")} sensors)`} value={fmt(getMetric(active.env,"co2"),0)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

      {/* Layers */}
            <div className={styles.section}>
                <h3 className={styles.muted}>Layers</h3>
                <div className={styles.layers}>
                    {active.layers.map((l) => (
                        <LayerCard key={l.id} layer={l} systemId={active.id} />
                    ))}
                </div>
            </div>

        </div>
    );
}