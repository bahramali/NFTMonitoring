// src/pages/Dashboard/DashboardV2.jsx
import React, { useMemo, useState } from "react";
import DeviceCard from "./DeviceCard.jsx";
import styles from "./DashboardV2.module.css";
import idealRangeConfig from "../../../idealRangeConfig.js";
import Stat from "./Stat.jsx";
import LayerCard from "./LayerCard.jsx";
import useWaterCompositeCards from "./useWaterCompositeCards.js";
import { fmt, localDateTime, normLayerId, aggregateFromCards, sensorLabel, normalizeSensors } from "../utils";
import { isWaterDevice } from "../utils/isWaterDevice.js";
import { useStomp } from "../../../hooks/useStomp";

/* ---------------------- helpers & hooks (local) ---------------------- */

// Parse "S01-L02-G03"
const splitComp = (cid) => {
  const [sys, lay, dev] = String(cid || "").trim().toUpperCase().split("-");
  return { sys, lay, dev };
};

// Build systems & layers index from live topics
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
      lay = String(data.layer || data.layerId || "").toUpperCase();
    }
    if (!sys) return;

    const ts = Number(data.timestamp || data.ts || Date.now());
    const layerId = lay ? normLayerId(lay) : null;

    setIndex((prev) => {
      const next = { ...prev };
      const cur = next[sys] || { id: sys, layers: [], lastTs: 0 };
      if (layerId && !cur.layers.includes(layerId)) cur.layers.push(layerId);
      cur.lastTs = Math.max(cur.lastTs || 0, ts);
      next[sys] = cur;
      return next;
    });
  });

  // Make an array consumable by the UI
  return React.useMemo(() => {
    const arr = Object.values(index).map((item) => ({
      id: item.id,
      name: item.id,
      updatedAt: item.lastTs ? localDateTime(item.lastTs) : "--",
      water: {},
      env: {},
      layers: item.layers.map((id) => ({ id, health: "ok" })), // health dot is cosmetic; LayerCard aggregates real data itself
    }));
    arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return arr;
  }, [index]);
}

// Collect ALL device cards for a given system (both grow & water)
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

    const sensors = data.sensors || data.values || data.env || data.water || data.payload || data.readings || [];
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

/* ------------------------------ component ------------------------------ */

export default function DashboardV2() {
  // Build systems & layers purely from live sensor streams
  const systems = useSystemsIndex();

    const [activeId, setActiveId] = useState(null);
  const active = systems.find((s) => s.id === activeId) || systems[0];

  // Water device cards (Txx) for the active system
  const waterCards = useWaterCompositeCards(active?.id).filter((card) => isWaterDevice(card.compId));
  const waterAgg = useMemo(() => aggregateFromCards(waterCards), [waterCards]);

  // All cards for the active system → filter non-water → aggregate for env overview
  const sysCards = useSystemCompositeCards(active?.id);
  const growCards = useMemo(() => sysCards.filter((c) => !isWaterDevice(c.compId)), [sysCards]);
  const envAgg = useMemo(() => aggregateFromCards(growCards), [growCards]);

  if (!systems.length) return <div className={styles.page}>Waiting for data…</div>;

    return (
        <div className={styles.page}>
            <div className={styles.tabs}>
        {systems.map((sys) => (
                    <button key={sys.id} className={`${styles.tab} ${active.id === sys.id ? styles.active : ""}`}
                            onClick={() => setActiveId(sys.id)}>System: {sys.name}</button>
                ))}
            </div>

            <div className={`${styles.card} ${styles.shadow} ${styles.systemCard}`}>
                <div className={styles.muted}>Last update: {active.updatedAt}</div>
                <h2>{active.name}</h2>

        {/* Water summary (aggregated on the client) */}
                <div className={styles.row}>
                    <div className={styles.col6}>
                        <div className={`${styles.subcard} ${styles.water}`}>
                            <h3>Water</h3>
                            <div className={styles.stats}>
                {WATER_STATS.map(({ label, key, precision, rangeKey }) => {
                  const count = waterAgg?.counts?.[key] || 0;
                  const value = fmt(waterAgg?.avg?.[key], precision);
                                    const range = idealRangeConfig[rangeKey]?.idealRange;
                  return <Stat key={key} label={`${label}=`} value={`${value} (${count} sensors)`} range={range} />;
                                })}
                            </div>
                            <div className={styles.divider}/>
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
                <div className={styles.divider}/>
                <div className={styles.section}>
                    <h3 className={styles.muted}>Layers</h3>

          {/* Environment overview (client-side aggregate over grow devices) */}
                    <div className={`${styles.subcard} ${styles.env}`}>
                        <h3>Environment overview</h3>
                        <div className={styles.stats}>
              {envAgg?.counts?.light > 0 && (
                <Stat
                  label="Light="
                  value={`${fmt(envAgg.avg.light)} lux (${envAgg.counts.light} sensors)`}
                  range={idealRangeConfig.lux?.idealRange}
                />
              )}
              {envAgg?.counts?.temperature > 0 && (
                                <Stat
                  label="Temp="
                  value={`${fmt(envAgg.avg.temperature)} °C (${envAgg.counts.temperature} sensors)`}
                  range={idealRangeConfig.temperature?.idealRange}
                                />
              )}
              {envAgg?.counts?.humidity > 0 && (
                <Stat
                  label="Humidity="
                  value={`${fmt(envAgg.avg.humidity)} % (${envAgg.counts.humidity} sensors)`}
                  range={idealRangeConfig.humidity?.idealRange}
                />
              )}
              {envAgg?.counts?.co2 > 0 && (
                <Stat label="CO₂=" value={`${fmt(envAgg.avg.co2, 0)} ppm (${envAgg.counts.co2} sensors)`} />
              )}
                        </div>
                        <div className={styles.divider}/>
                        <div className={styles.layers}>
              {active.layers.map((l) => (
                <LayerCard key={l.id} layer={l} systemId={active.id} />
              ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

/* keys must match normalized sensor keys from utils/normalizeSensors */
const WATER_STATS = [
  { label: "pH", key: "pH", precision: 1, rangeKey: "ph" },
    {label: "DO", key: "dissolvedOxygen", precision: 1, rangeKey: "dissolvedOxygen"},
    {label: "EC", key: "dissolvedEC", precision: 2, rangeKey: "ec"},
    {label: "TDS", key: "dissolvedTDS", precision: 0, rangeKey: "tds"},
    {label: "Temp", key: "dissolvedTemp", precision: 1, rangeKey: "temperature"},
];
