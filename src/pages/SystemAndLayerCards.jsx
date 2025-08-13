import React from "react";
import styles from "./SystemAndLayerCards.module.css";

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
export function MetricCard({title, value, unit, icon}) {
    return (
        <div className={cx("metric-card")}>
            <div className={cx("metric-top")}>
                <div className={cx("metric-value")}>
                    <strong>{value}</strong>
                    {unit ? <span className={cx("metric-unit")}>{unit}</span> : null}
                </div>
            </div>
            <div className={cx("metric-title")}>{title}</div>
            {icon ? <div className={cx("metric-icon")}>{icon}</div> : null}
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
        <div className={cx("sys-card")} onClick={onClick} role={onClick ? "button" : undefined}>
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
                <MetricCard title="Water Temp" value={metrics.waterTemp.toFixed(1)} unit="°C" icon={<span>🌡️</span>}/>
                <MetricCard title="pH" value={metrics.pH.toFixed(1)} icon={<span>⚗️</span>}/>
                <MetricCard title="EC" value={metrics.EC.toFixed(2)} unit="mS/cm" icon={<span>📈</span>}/>
                <MetricCard title="DO" value={metrics.DO.toFixed(1)} unit="mg/L" icon={<span>O₂</span>}/>
                <MetricCard title="Air Pump" value={metrics.airPump ? "On" : "Off"} icon={<span>🫧</span>}/>
            </div>
        </div>
    );
}

/* ========== Layer Panel ========== */
export function LayerPanel({id, health, metrics, children}) {
    return (
        <div className={cx("layer-card")}>
            <div className={cx("layer-head")}>
                <StatusDot health={health}/>
                <span className={cx("layer-title")}>Layer {id}</span>
            </div>

            <div className={cx("metrics-row", "three")}>
                <MetricCard title="Light" value={metrics.lux.toFixed(1)} unit="lx"/>
                <MetricCard title="Temperature" value={metrics.temp.toFixed(1)} unit="°C"/>
                <MetricCard title="Humidity" value={metrics.humidity.toFixed(1)} unit="%"/>
            </div>

            {children ? <div className={cx("layer-children")}>{children}</div> : null}
        </div>
    );
}

