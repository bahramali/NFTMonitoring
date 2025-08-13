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
// کارت با استایل شبیه تصویر (آیکن، عدد بزرگ، عنوان، زیرنویس)
export function MetricCard({ title, value, unit, icon, subtitle }) {
    return (
        <div className={cx("metric-card-neo")}>
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
                <MetricCard title="Water Temp" value={fmt(metrics.waterTemp, 1)} unit="°C" icon={<span>🌡️</span>} subtitle={metrics?._counts?.waterTemp != null ? `Composite IDs: ${metrics._counts.waterTemp}` : undefined} />
                <MetricCard title="pH"        value={fmt(metrics.pH, 1)}              icon={<span>⚗️</span>}     subtitle={metrics?._counts?.pH != null ? `Composite IDs: ${metrics._counts.pH}` : undefined} />
                <MetricCard title="EC"        value={fmt(metrics.EC, 2)}   unit="mS/cm" icon={<span>📈</span>}     subtitle={metrics?._counts?.EC != null ? `Composite IDs: ${metrics._counts.EC}` : undefined} />
                <MetricCard title="DO"        value={fmt(metrics.DO, 1)}   unit="mg/L"  icon={<span>O₂</span>}     subtitle={metrics?._counts?.DO != null ? `Composite IDs: ${metrics._counts.DO}` : undefined} />
                <MetricCard title="Air Pump"  value={metrics.airPump ? "On" : "Off"}    icon={<span>🫧</span>}     subtitle={metrics?._counts?.airPump != null ? `Composite IDs: ${metrics._counts.airPump}` : undefined} />

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

            <div className="metrics-row three">
                <MetricCard title="Light"       value={fmt(metrics.lux, 1)} unit="lx"  icon={<span>☀️</span>}  subtitle={metrics?._counts?.light != null ? `Composite IDs: ${metrics._counts.light}` : undefined} />
                <MetricCard title="Temperature" value={fmt(metrics.temp, 1)} unit="°C" icon={<span>🌡️</span>}  subtitle={metrics?._counts?.temperature != null ? `Composite IDs: ${metrics._counts.temperature}` : undefined} />
                <MetricCard title="Humidity"    value={fmt(metrics.humidity, 1)} unit="%" icon={<span>%</span>} subtitle={metrics?._counts?.humidity != null ? `Composite IDs: ${metrics._counts.humidity}` : undefined} />
            </div>


            {children ? <div className={cx("layer-children")}>{children}</div> : null}
        </div>
    );
}

