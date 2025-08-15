// src/pages/DashboardPage.jsx
import React, {useMemo} from "react";
import {useLiveNow} from "../hooks/useLiveNow";
import {SystemOverviewCard, LayerPanel} from "./SystemAndLayerCards";

// If you don't have a CSS module for this page, keep styles as empty.
const styles = {};

// ---------- helpers ----------
const toNum = (v) => (v == null ? null : Number(v));
const avg = (arr) => {
    const xs = arr.map(toNum).filter((n) => typeof n === "number" && !Number.isNaN(n));
    return xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)) : null;
};
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
function normalizeLiveNow(payload) {
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
            const {avg: DO, count: DOCount} = getMetric(water, "dissolvedOxygen");
            const {avg: airPumpAvg, count: airPumpCount} = getMetric(
                acts,
                "airpump"
            );
            const airPump = airPumpAvg == null ? null : airPumpAvg >= 0.5;

            const hasAny = [lux, temp, humidity, DO, airPumpAvg].some(
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
                    DO: DO ?? null,
                    airPump,
                    _counts: {DO: DOCount, airPump: airPumpCount},
                },
            });
        }

        // System-level metrics or aggregates from layers
        const sysWater = sys.water ?? {};
        const sysActs = sys.actuators ?? {};
        const {avg: waterTempAvg, count: waterTempCount} = getMetric(
            sysWater,
            "temperature"
        );
        const {avg: pHavg, count: pHcount} = getMetric(sysWater, "pH", "ph");
        const {avg: ECavg, count: ECcount} = getMetric(sysWater, "EC", "ec");
        const {avg: DOavg, count: DOcount} = getMetric(
            sysWater,
            "dissolvedOxygen"
        );
        const {avg: airPumpSysAvg, count: airPumpSysCount} = getMetric(
            sysActs,
            "airpump"
        );

        const waterTemp =
            waterTempAvg ?? avg(layerCards.map((l) => l.metrics.temp));
        const DOmetric =
            DOavg ?? avg(layerCards.map((l) => l.water.DO).filter((v) => v != null));
        const airPumpOn =
            airPumpSysAvg != null
                ? airPumpSysAvg >= 0.5
                : layerCards.some((l) => l.water.airPump === true);

        const sysCounts = {
            waterTemp:
                waterTempCount ??
                layerCards.reduce(
                    (a, l) => a + (l.metrics?._counts?.temperature ?? 0),
                    0
                ),
            pH: pHcount ?? null,
            EC: ECcount ?? null,
            DO:
                DOcount ??
                layerCards.reduce((a, l) => a + (l.water?._counts?.DO ?? 0), 0),
            airPump:
                airPumpSysCount ??
                layerCards.reduce(
                    (a, l) => a + (l.water?._counts?.airPump ?? 0),
                    0
                ),
        };

        systems.push({
            systemId: sys.systemId ?? sysId,
            status: sys.status ?? "Active",
            devicesOnline: sys.devicesOnline ?? 0,
            devicesTotal: sys.devicesTotal ?? 0,
            sensorsHealthy: sys.sensorsHealthy ?? 0,
            sensorsTotal: sys.sensorsTotal ?? 0,
            lastUpdateMs: toNum(sys.lastUpdate) ?? Date.now(),
            layers: layerCards.map((l) => ({id: l.id, health: l.health})),
            metrics: {
                waterTemp: waterTemp ?? null,
                pH: pHavg ?? null,
                EC: ECavg ?? null,
                DO: DOmetric ?? null,
                airPump: !!airPumpOn,
                _counts: sysCounts,
            },
            _layerCards: layerCards,
        });
    }

    systems.sort((a, b) => String(a.systemId).localeCompare(String(b.systemId)));
    return systems;
}

// ---------- Page (no system filter) ----------
export default function DashboardPage() {
    const live = useLiveNow();
    const systems = useMemo(() => normalizeLiveNow(live), [live]);

    if (!live) return <div className={styles.page}>Connecting to live_now…</div>;
    if (!systems.length) return <div className={styles.page}>No systems in live_now yet.</div>;

    return (
        <div className={styles.page} style={{padding: 16}}>
            {systems.map((sys) => (
                <div key={sys.systemId} style={{marginBottom: 24}}>
                    {/* System overview */}
                    <SystemOverviewCard {...sys} />

                    {/* Layer cards */}
                    <div
                        style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            marginTop: 16,
                        }}
                    >
                        {(sys._layerCards || []).map((l) => (
                            <LayerPanel
                                key={l.id}
                                id={l.id}
                                health={l.health}
                                metrics={{...l.metrics, _counts: l.metrics?._counts}}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
