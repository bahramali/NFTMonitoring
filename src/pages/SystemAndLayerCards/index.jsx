import React from "react";
import styles from "./SystemAndLayerCards.module.css";

const fmt = (v, d = 1) =>
    v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d);

// map helper: names -> module classes
const cx = (...names) =>
    names.filter(Boolean).map((n) => styles[n] || n).join(" ");

/* ========== Utils ========== */

// eslint-disable-next-line react-refresh/only-export-components
export function timeAgo(ts) {
    if (!ts) return "—";
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

function StatusDot({health}) {
    return (
        <span
            className={cx(
                "status-dot",
                health === "ok" && "status-ok",
                health === "warn" && "status-warn",
                health === "down" && "status-down"
            )}
        />
    );
}

function Pill({label, health}) {
    return (
        <span className={cx("layer-pill")}>
      <StatusDot health={health}/>
            {label}
    </span>
    );
}

/* ========== Metric Card ========== */
// Card styled like the image (icon, large number, title, subtitle)
export function MetricCard({ title, value, unit, icon, subtitle, compact }) {
    return (
        <div className={cx("metric-card", compact && "compact")}>
            <div className={cx("metric-row-top")}>
                <div className={cx("metric-icon-lg")}>{icon}</div>
                <div className={cx("metric-reading")}>
                    <span className={cx("metric-big")}>{value}</span>
                    {unit ? <span className={cx("metric-unit-sm")}>{unit}</span> : null}
                </div>
            </div>
            <div className={cx("metric-bottom")}>
                <div className={cx("metric-title2")}>{title}</div>
                {subtitle ? <div className={cx("metric-sub")}>{subtitle}</div> : null}
            </div>
        </div>
    );
}

/* ========== System Overview Card ========== */
export function SystemOverviewCard({
                                       systemId,
                                       status,
                                       devicesOnline,
                                       devicesTotal,
                                       sensorsHealthy,
                                       sensorsTotal,
                                       lastUpdateMs,
                                       layers,
                                       metrics,
                                       onClick,
                                   }) {
    return (
        <div className={cx("card")} onClick={onClick} role={onClick ? "button" : undefined}>
            <div className={cx("sys-head")}>
                <div className={cx("sys-head-left")}>
                    <StatusDot health={status === "Active" ? "ok" : "down"}/>
                    <span className={cx("sys-status")}>{status}</span>
                    <span className={cx("sys-sub")}>System {systemId}</span>
                </div>
                <div className={cx("sys-head-right")}>
          <span>
            Devices: <b>{devicesOnline}/{devicesTotal}</b>
          </span>
                    <span className={cx("sep")}>|</span>
                    <span>
            Sensors: <b>{sensorsHealthy}/{sensorsTotal}</b>
          </span>
                    <span className={cx("sep")}>|</span>
                    <span>Last update: <b>{timeAgo(lastUpdateMs)}</b></span>
                </div>
            </div>

            <div className={cx("sys-section")}>
                <div className={cx("label")}>LAYERS</div>
                <div className={cx("layers-row")}>
                    {layers.map((l) => (
                        <Pill key={l.id} label={l.id} health={l.health}/>
                    ))}
                </div>
            </div>

            <div className={cx("metrics-row")}> 
                <div className={cx("metrics-group")}> 
                    <MetricCard compact title="Water Temp" value={fmt(metrics.dissolvedTemp, 1)} unit="°C" icon={<span>🌡️</span>} subtitle={metrics?._counts?.dissolvedTemp != null ? `Composite IDs: ${metrics._counts.dissolvedTemp}` : undefined} />
                    <MetricCard compact title="DO" value={fmt(metrics.dissolvedOxygen, 1)} unit="mg/L" icon={<span>O₂</span>} subtitle={metrics?._counts?.dissolvedOxygen != null ? `Composite IDs: ${metrics._counts.dissolvedOxygen}` : undefined} />
                    <MetricCard compact title="EC" value={fmt(metrics.dissolvedEC, 2)} unit="mS/cm" icon={<span>📈</span>} subtitle={metrics?._counts?.dissolvedEC != null ? `Composite IDs: ${metrics._counts.dissolvedEC}` : undefined} />
                    <MetricCard compact title="TDS" value={fmt(metrics.dissolvedTDS, 0)} unit="ppm" icon={<span>💧</span>} subtitle={metrics?._counts?.dissolvedTDS != null ? `Composite IDs: ${metrics._counts.dissolvedTDS}` : undefined} />
                    <MetricCard compact title="pH" value={fmt(metrics.pH, 1)} icon={<span>⚗️</span>} subtitle={metrics?._counts?.pH != null ? `Composite IDs: ${metrics._counts.pH}` : undefined} />
                    <MetricCard compact title="Air Pump" value={metrics.airPump ? "On" : "Off"} icon={<span>🫧</span>} subtitle={metrics?._counts?.airPump != null ? `Composite IDs: ${metrics._counts.airPump}` : undefined} />
                </div>
                <div className={cx("metrics-group")}> 
                    <MetricCard compact title="Light" value={fmt(metrics.light, 1)} unit="lux" icon={<span>☀️</span>} subtitle={metrics?._counts?.light != null ? `Composite IDs: ${metrics._counts.light}` : undefined} />
                    <MetricCard compact title="Humidity" value={fmt(metrics.humidity, 1)} unit="%" icon={<span>%</span>} subtitle={metrics?._counts?.humidity != null ? `Composite IDs: ${metrics._counts.humidity}` : undefined} />
                    <MetricCard compact title="Temperature" value={fmt(metrics.temperature, 1)} unit="°C" icon={<span>🌡️</span>} subtitle={metrics?._counts?.temperature != null ? `Composite IDs: ${metrics._counts.temperature}` : undefined} />
                </div>
            </div>
        </div>
    );
}

/* ========== Layer Panel ========== */
export function LayerPanel({id, health, metrics, water = {}, actuators = {}, children}) {
    return (
        <div className={cx("card", "layer-card")}> 
            <div className={cx("layer-head")}>
                <StatusDot health={health}/>
                <span className={cx("layer-title")}>Layer {id}</span>
            </div>

            <div className={cx("metrics-row")}> 
                <div className={cx("metrics-group")}> 
                    <MetricCard compact title="Water Temp" value={fmt(water.dissolvedTemp, 1)} unit="°C" icon={<span>🌡️</span>} subtitle={water?._counts?.dissolvedTemp != null ? `Composite IDs: ${water._counts.dissolvedTemp}` : undefined} />
                    <MetricCard compact title="DO" value={fmt(water.dissolvedOxygen, 1)} unit="mg/L" icon={<span>O₂</span>} subtitle={water?._counts?.dissolvedOxygen != null ? `Composite IDs: ${water._counts.dissolvedOxygen}` : undefined} />
                    <MetricCard compact title="pH" value={fmt(water.pH, 1)} icon={<span>⚗️</span>} subtitle={water?._counts?.pH != null ? `Composite IDs: ${water._counts.pH}` : undefined} />
                    <MetricCard compact title="EC" value={fmt(water.dissolvedEC, 2)} unit="mS/cm" icon={<span>📈</span>} subtitle={water?._counts?.dissolvedEC != null ? `Composite IDs: ${water._counts.dissolvedEC}` : undefined} />
                    <MetricCard compact title="TDS" value={fmt(water.dissolvedTDS, 0)} unit="ppm" icon={<span>💧</span>} subtitle={water?._counts?.dissolvedTDS != null ? `Composite IDs: ${water._counts.dissolvedTDS}` : undefined} />
                    <MetricCard compact title="Air Pump" value={actuators.airPump ? "On" : "Off"} icon={<span>🫧</span>} subtitle={actuators?._counts?.airPump != null ? `Composite IDs: ${actuators._counts.airPump}` : undefined} />
                </div>
                <div className={cx("metrics-group")}> 
                    <MetricCard compact title="Light" value={fmt(metrics.lux, 1)} unit="lx" icon={<span>☀️</span>} subtitle={metrics?._counts?.light != null ? `Composite IDs: ${metrics._counts.light}` : undefined} />
                    <MetricCard compact title="Temperature" value={fmt(metrics.temp, 1)} unit="°C" icon={<span>🌡️</span>} subtitle={metrics?._counts?.temperature != null ? `Composite IDs: ${metrics._counts.temperature}` : undefined} />
                    <MetricCard compact title="Humidity" value={fmt(metrics.humidity, 1)} unit="%" icon={<span>%</span>} subtitle={metrics?._counts?.humidity != null ? `Composite IDs: ${metrics._counts.humidity}` : undefined} />
                </div>
            </div>

            {children ? <div className={cx("layer-children")}>{children}</div> : null}
        </div>
    );
}

