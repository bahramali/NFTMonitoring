// src/pages/DashboardPage.jsx
import React, {useEffect, useMemo, useState} from "react";
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
 * Input payload: object keyed by system IDs (S01, S02, ...)
 * Output: array of systems shaped for SystemOverviewCard + _layerCards for LayerPanel
 */
function normalizeLiveNow(payload) {
    const root = payload?.systems ?? payload;
    if (!root || typeof root !== "object") return [];

    const systems = [];

    for (const [sysId, layersObj] of Object.entries(root)) {
        if (!layersObj || typeof layersObj !== "object") continue;

        const layerCards = [];

        for (const [layerKey, m] of Object.entries(layersObj)) {
            const id = normLayerId(layerKey);

            // averages
            const lux = toNum(m?.light?.average);
            const temp = toNum(m?.temperature?.average);
            const humidity = toNum(m?.humidity?.average);
            const DO = toNum(m?.dissolvedOxygen?.average);
            const airPumpAvg = toNum(m?.airpump?.average); // 0/1
            const airPump = airPumpAvg == null ? null : airPumpAvg >= 0.5;

            // counts (برای زیرنویس Composite IDs)
            const counts = {
                light: m?.light?.deviceCount ?? null,
                temperature: m?.temperature?.deviceCount ?? null,
                humidity: m?.humidity?.deviceCount ?? null,
                DO: m?.dissolvedOxygen?.deviceCount ?? null,
                airPump: m?.airpump?.deviceCount ?? null,
            };

            const hasAny = [lux, temp, humidity, DO, airPumpAvg].some((v) => v != null);
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
                        light: counts.light,
                        temperature: counts.temperature,
                        humidity: counts.humidity,
                    },
                },
                water: {
                    DO: DO ?? null,
                    airPump,
                    _counts: {DO: counts.DO, airPump: counts.airPump},
                },
            });
        }

        // Aggregate system-level metrics (adjust if you get real water temp / pH / EC)
        const waterTemp = avg(layerCards.map((l) => l.metrics.temp));
        const DOavg = avg(layerCards.map((l) => l.water.DO).filter((v) => v != null));
        const airPumpOn = layerCards.some((l) => l.water.airPump === true);

        const sysCounts = {
            waterTemp: layerCards.reduce(
                (a, l) => a + (l.metrics?._counts?.temperature ?? 0),
                0
            ),
            pH: null,
            EC: null,
            DO: layerCards.reduce((a, l) => a + (l.water?._counts?.DO ?? 0), 0),
            airPump: layerCards.reduce((a, l) => a + (l.water?._counts?.airPump ?? 0), 0),
        };

        systems.push({
            systemId: sysId,
            status: "Active",
            devicesOnline: 0,
            devicesTotal: 0,
            sensorsHealthy: 0,
            sensorsTotal: 0,
            lastUpdateMs: Date.now(),
            layers: layerCards.map((l) => ({id: l.id, health: l.health})),
            metrics: {
                waterTemp: waterTemp ?? null,
                pH: null,
                EC: null,
                DO: DOavg ?? null,
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
