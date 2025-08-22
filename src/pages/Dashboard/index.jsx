// src/pages/Dashboard/index.jsx
/* eslint-disable react-refresh/only-export-components */
import React, {useEffect, useMemo, useState} from "react";
import {useLiveNow} from "../../hooks/useLiveNow";
import {SystemOverviewCard, LayerPanel} from "../SystemAndLayerCards";
import FilterBar from "./components/FilterBar";
import styles from "./Dashboard.module.css";

// ---------- helpers ----------
const toNum = (v) => (v == null ? null : Number(v));
// Normalize "L01" / "layer1" → "L01"
const normLayerId = (k) => {
    if (/^L\d+$/i.test(k)) return k.toUpperCase();
    const m = /^layer(\d+)$/i.exec(k);
    if (m) return `L${String(m[1]).padStart(2, "0")}`;
    return k;
};

/**
 * normalizeLiveNow
 * Input payload: object keyed by system IDs (S01, S02, ...), each containing
 *  {lastUpdate, environment, water, actuators, layers: []}
 * Output: array of systems shaped for SystemOverviewCard + _layerCards for LayerPanel
 */
export function normalizeLiveNow(payload) {
    const root = payload?.systems ?? payload;
    if (!root || typeof root !== "object") return [];

    const systems = [];

    // helper to pull metric averages + counts
    const getMetric = (obj, ...keys) => {
        if (!obj) return {avg: null, count: null};
        for (const k of keys) {
            const val =
                obj[k] ?? obj[String(k).toLowerCase()] ?? obj[String(k).toUpperCase()];
            if (val != null) {
                if (typeof val === "object") {
                    return {
                        avg: toNum(val.average ?? val.avg ?? val.value),
                        count: val.deviceCount ?? val.count ?? null,
                    };
                }
                return {avg: toNum(val), count: null};
            }
        }
        return {avg: null, count: null};
    };

    for (const [sysId, sys] of Object.entries(root)) {
        if (!sys || typeof sys !== "object") continue;

        const layerCards = [];
        const layersArr = Array.isArray(sys.layers) ? sys.layers : [];

        for (const layer of layersArr) {
            const id = normLayerId(layer?.id ?? layer?.layerId ?? "");
            const env = layer?.environment ?? {};
            const water = layer?.water ?? {};
            const acts = layer?.actuators ?? {};

            const {avg: lux, count: lightCount} = getMetric(env, "light");
            const {avg: temp, count: tempCount} = getMetric(env, "temperature");
            const {avg: humidity, count: humidityCount} = getMetric(env, "humidity");

            const {avg: dTemp, count: dTempCount} = getMetric(water, "dissolvedTemp");
            const {avg: DO, count: DOCount} = getMetric(water, "dissolvedOxygen");
            const {avg: pH, count: pHCount} = getMetric(water, "pH", "ph");
            const {avg: EC, count: ECCount} = getMetric(water, "dissolvedEC");
            const {avg: TDS, count: TDSCount} = getMetric(water, "dissolvedTDS");

            const {avg: airPumpAvg, count: airPumpCount} = getMetric(acts, "airpump");
            const airPump = airPumpAvg == null ? null : airPumpAvg >= 0.5;

            const hasAny = [lux, temp, humidity, dTemp, DO, pH, EC, TDS, airPumpAvg].some(
                (v) => v != null
            );
            const missingEnv = [lux, temp, humidity].some((v) => v == null);
            const health = !hasAny ? "down" : missingEnv ? "warn" : "ok";

            layerCards.push({
                id,
                health,
                metrics: {
                    lux: lux ?? null,
                    temp: temp ?? null,
                    humidity: humidity ?? null,
                    _counts: {
                        light: lightCount,
                        temperature: tempCount,
                        humidity: humidityCount,
                    },
                },
                water: {
                    dissolvedTemp: dTemp ?? null,
                    dissolvedOxygen: DO ?? null,
                    pH: pH ?? null,
                    dissolvedEC: EC ?? null,
                    dissolvedTDS: TDS ?? null,
                    _counts: {
                        dissolvedTemp: dTempCount,
                        dissolvedOxygen: DOCount,
                        pH: pHCount,
                        dissolvedEC: ECCount,
                        dissolvedTDS: TDSCount,
                    },
                },
                actuators: {
                    airPump,
                    _counts: { airPump: airPumpCount },
                },
            });
        }

        // System-level metrics taken directly from system JSON
        const sysEnv = sys.environment ?? {};
        const {avg: lightAvg, count: lightCount} = getMetric(sysEnv, "light");
        const {avg: humidityAvg, count: humidityCount} = getMetric(sysEnv, "humidity");
        const {avg: tempAvg, count: tempCount} = getMetric(
            sysEnv,
            "temperature"
        );

        const sysWater = sys.water ?? {};
        const {avg: dTempAvg, count: dTempCount} = getMetric(
            sysWater,
            "dissolvedTemp"
        );
        const {avg: DOavg, count: DOcount} = getMetric(
            sysWater,
            "dissolvedOxygen"
        );
        const {avg: ECavg, count: ECcount} = getMetric(
            sysWater,
            "dissolvedEC"
        );
        const {avg: TDSavg, count: TDScount} = getMetric(
            sysWater,
            "dissolvedTDS"
        );
        const {avg: pHavg, count: pHcount} = getMetric(sysWater, "pH", "ph");

        const sysActs = sys.actuators ?? {};
        const {avg: airPumpAvg, count: airPumpCount} = getMetric(
            sysActs,
            "airPump",
            "airpump"
        );
        const airPump = airPumpAvg == null ? null : airPumpAvg >= 0.5;

        systems.push({
            systemId: sys.systemId ?? sysId,
            status: sys.status ?? "Active",
            devicesOnline: sys.devicesOnline ?? 0,
            devicesTotal: sys.devicesTotal ?? 0,
            sensorsHealthy: sys.sensorsHealthy ?? 0,
            sensorsTotal: sys.sensorsTotal ?? 0,
            lastUpdateMs: toNum(sys.lastUpdate),
            layers: layerCards.map((l) => ({id: l.id, health: l.health})),
            metrics: {
                light: lightAvg ?? null,
                humidity: humidityAvg ?? null,
                temperature: tempAvg ?? null,
                dissolvedTemp: dTempAvg ?? null,
                dissolvedOxygen: DOavg ?? null,
                dissolvedEC: ECavg ?? null,
                dissolvedTDS: TDSavg ?? null,
                pH: pHavg ?? null,
                airPump: airPump,
                _counts: {
                    light: lightCount,
                    humidity: humidityCount,
                    temperature: tempCount,
                    dissolvedTemp: dTempCount,
                    dissolvedOxygen: DOcount,
                    dissolvedEC: ECcount,
                    dissolvedTDS: TDScount,
                    pH: pHcount,
                    airPump: airPumpCount,
                },
            },
            _layerCards: layerCards,
        });
    }

    systems.sort((a, b) => String(a.systemId).localeCompare(String(b.systemId)));
    return systems;
}

// ---------- Page (no system filter) ----------
export default function Dashboard() {
    const live = useLiveNow();
    const systems = useMemo(() => normalizeLiveNow(live), [live]);

    const [selected, setSelected] = useState({});

    useEffect(() => {
        setSelected((prev) => {
            const next = {};
            systems.forEach((sys) => {
                next[sys.systemId] = {};
                (sys._layerCards || []).forEach((l) => {
                    next[sys.systemId][l.id] = prev?.[sys.systemId]?.[l.id] ?? true;
                });
            });
            return next;
        });
    }, [systems]);

    const handleToggle = (sysId, layerId) => {
        setSelected((prev) => ({
            ...prev,
            [sysId]: {
                ...prev[sysId],
                [layerId]: !prev?.[sysId]?.[layerId],
            },
        }));
    };

    if (!live) return <div className={styles.page}>Connecting to live_now…</div>;
    if (!systems.length) return <div className={styles.page}>No systems in live_now yet.</div>;

    return (
        <div className={styles.page} style={{padding: 16}}>
            <FilterBar systems={systems} selected={selected} onToggle={handleToggle} />
            {systems.map((sys) => {
                const visibleLayerCards = (sys._layerCards || []).filter(
                    (l) => selected[sys.systemId]?.[l.id]
                );
                if (visibleLayerCards.length === 0) return null;
                const visibleLayers = visibleLayerCards.map((l) => ({
                    id: l.id,
                    health: l.health,
                }));
                return (
                    <div key={sys.systemId} style={{marginBottom: 24}}>
                        {/* System overview */}
                        <SystemOverviewCard {...sys} layers={visibleLayers} />

                        {/* Layer cards */}
                        <div
                            style={{
                                display: "grid",
                                gap: 12,
                                gridTemplateColumns: "1fr",
                                marginTop: 16,
                                marginLeft: "1rem",
                            }}
                        >
                            {visibleLayerCards.map((l) => (
                                <LayerPanel
                                    key={l.id}
                                    id={l.id}
                                    health={l.health}
                                    metrics={{...l.metrics, _counts: l.metrics?._counts}}
                                    water={{...l.water, _counts: l.water?._counts}}
                                    actuators={{...l.actuators, _counts: l.actuators?._counts}}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
