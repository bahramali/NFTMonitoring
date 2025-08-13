// src/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styles from "./DashboardPage.module.css"; // اگر نداری حذفش کن
import { useLiveNow } from "../hooks/useLiveNow";
import { SystemOverviewCard, LayerPanel } from "./SystemAndLayerCards";

// --- helpers ---
const toNum = (v) => (v == null ? null : Number(v));
const avg = (arr) => {
    const xs = arr.map(toNum).filter((n) => typeof n === "number" && !Number.isNaN(n));
    return xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)) : null;
};

// L01 / L02 / layer1 → L01
const normLayerId = (k) => {
    if (/^L\d+$/i.test(k)) return k.toUpperCase();
    const m = /^layer(\d+)/i.exec(k);
    if (m) return `L${String(m[1]).padStart(2, "0")}`;
    return k;
};

// PAYLOAD normalizer (object با کلید سیستم‌ها)
function normalizeLiveNow(payload) {
    const root = payload?.systems ?? payload; // اگر backend داخل field دیگری گذاشته
    if (!root || typeof root !== "object") return [];

    const systems = [];

    for (const [sysId, layersObj] of Object.entries(root)) {
        if (!layersObj || typeof layersObj !== "object") continue;

        const layerCards = [];

        for (const [layerKey, m] of Object.entries(layersObj)) {
            const id = normLayerId(layerKey);
            const lux = toNum(m?.light?.average);
            const temp = toNum(m?.temperature?.average);
            const humidity = toNum(m?.humidity?.average);
            const DO = toNum(m?.dissolvedOxygen?.average);
            const airPumpAvg = toNum(m?.airpump?.average); // 0/1
            const airPump = airPumpAvg == null ? null : airPumpAvg >= 0.5;

            const hasAny = [lux, temp, humidity, DO, airPumpAvg].some((v) => v != null);
            const missingEnv = [lux, temp, humidity].some((v) => v == null);
            const health = !hasAny ? "down" : missingEnv ? "warn" : "ok";

            layerCards.push({
                id,
                health,
                metrics: {
                    // کارت‌های لایه (Light/Temperature/Humidity)
                    lux: lux ?? 0,
                    temp: temp ?? 0,
                    humidity: humidity ?? 0,
                },
                water: { DO, airPump },
            });
        }

        const waterTemp = avg(layerCards.map((l) => l.metrics.temp));
        const DOavg = avg(layerCards.map((l) => l.water.DO).filter((v) => v != null));
        const airPumpOn = layerCards.some((l) => l.water.airPump === true);

        systems.push({
            // props مورد نیاز SystemOverviewCard
            systemId: sysId,
            status: "Active",
            devicesOnline: 0,
            devicesTotal: 0,
            sensorsHealthy: 0,
            sensorsTotal: 0,
            lastUpdateMs: Date.now(), // زمان دریافت این پیام؛ payload زمان ندارد
            layers: layerCards.map((l) => ({ id: l.id, health: l.health })),
            metrics: {
                waterTemp: waterTemp ?? 0,
                pH: 0,            // در payload نیست → صفر/نمایش —
                EC: 0,            // در payload نیست → صفر/نمایش —
                DO: DOavg ?? 0,
                airPump: !!airPumpOn,
            },
            _layerCards: layerCards, // برای رندر Panel لایه‌ها
        });
    }

    return systems;
}

// --- page ---
export default function DashboardPage() {
    const live = useLiveNow(); // پیام زنده از /topic/live_now
    const systemsNorm = useMemo(() => normalizeLiveNow(live), [live]);

    const [sysId, setSysId] = useState("");
    useEffect(() => {
        if (systemsNorm.length && !systemsNorm.find((s) => s.systemId === sysId)) {
            setSysId(systemsNorm[0].systemId);
        }
    }, [systemsNorm, sysId]);

    if (!live) return <div className={styles?.page}>Connecting to live_now…</div>;
    if (!systemsNorm.length) return <div className={styles?.page}>No systems in live_now yet.</div>;

    const active =
        systemsNorm.find((s) => s.systemId === sysId) || systemsNorm[0];

    const layerPanels = (active._layerCards || []).map((l) => ({
        id: l.id,
        health: l.health,
        metrics: l.metrics,
    }));

    return (
        <div className={styles?.page}>
            <div style={{ marginBottom: 12 }}>
                <select
                    value={active.systemId}
                    onChange={(e) => setSysId(e.target.value)}
                    style={{ padding: 8, borderRadius: 12, border: "1px solid #e5e7eb" }}
                >
                    {systemsNorm.map((s) => (
                        <option key={s.systemId} value={s.systemId}>
                            {s.systemId}
                        </option>
                    ))}
                </select>
            </div>

            <SystemOverviewCard {...active} />

            <div
                style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    marginTop: 16,
                }}
            >
                {layerPanels.map((lp) => (
                    <LayerPanel key={lp.id} {...lp} />
                ))}
            </div>
        </div>
    );
}
