import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import DeviceCard from '../Overview/components/DeviceCard.jsx';
import { fetchMyDevices } from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { deriveFromSensors } from '../../utils/normalizeSensors.js';
import styles from './CustomerDashboard.module.css';

const normalizeDevices = (payload = []) => {
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.devices) ? payload.devices : [];
    return list
        .map((device, index) => {
            const id =
                device.id ??
                device.deviceId ??
                device.serialNumber ??
                device.compositeId ??
                device.identifier ??
                `device-${index + 1}`;
            const statusRaw = device.status ?? device.state ?? device.online;
            const status =
                typeof statusRaw === 'boolean'
                    ? statusRaw
                        ? 'ONLINE'
                        : 'OFFLINE'
                    : statusRaw || 'UNKNOWN';
            const lastSeen =
                device.lastSeen ??
                device.lastTelemetry ??
                device.lastTelemetryAt ??
                device.lastUpdate ??
                device.updatedAt ??
                device.timestamp;

            return {
                id,
                name: device.name ?? device.displayName ?? device.deviceName ?? id,
                status,
                lastSeen,
                sensors: device.sensors ?? device.readings ?? device.sensorReadings ?? device.data ?? [],
                metrics: device.metrics ?? device.latest ?? {},
                activeAlerts: device.activeAlerts ?? device.alertCount ?? device.alertsActive ?? null,
                raw: device,
            };
        })
        .filter((device) => device.id);
};

const formatDateTime = (value) => {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString();
};

const formatMetric = (label, value, unit) => {
    if (value == null || Number.isNaN(Number(value))) return null;
    const formattedValue = Number.isInteger(Number(value))
        ? Number(value).toString()
        : Number(value).toFixed(1);
    const suffix = unit ? ` ${unit}` : '';
    return { label, display: `${formattedValue}${suffix}` };
};

const deriveMetrics = (device) => {
    const derived = deriveFromSensors(device.sensors || []);
    const map = derived.map || {};
    const metrics = device.metrics || {};

    const candidates = [
        formatMetric('Temperature', metrics.tempC ?? metrics.temperature ?? map.temp, '°C'),
        formatMetric('Humidity', metrics.humidity ?? map.humidity, '%'),
        formatMetric('CO₂', metrics.co2 ?? map.co2, 'ppm'),
        formatMetric('EC', metrics.ec ?? map.ec, 'mS/cm'),
        formatMetric('TDS', metrics.tds ?? map.tds, 'ppm'),
    ].filter(Boolean);

    return candidates.slice(0, 4);
};

const statusClassName = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'ONLINE') return styles.statusOnline;
    if (normalized === 'OFFLINE') return styles.statusOffline;
    return styles.statusUnknown;
};

export default function CustomerDashboard() {
    const { token, logout } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const navigate = useNavigate();
    const { profile, loadingProfile, ordersState, loadOrders } = useOutletContext();

    const [devices, setDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(true);
    const [devicesError, setDevicesError] = useState(null);
    const reportsEnabled = useMemo(() => {
        const envFlag = import.meta.env?.VITE_CUSTOMER_REPORTS === 'true';
        const featureFlag = Array.isArray(profile?.features) && profile.features.includes('CUSTOMER_REPORTS');
        return envFlag || featureFlag;
    }, [profile?.features]);

    useEffect(() => {
        if (ordersState.supported === null && !ordersState.loading) {
            loadOrders({ silent: true }).catch(() => {});
        }
    }, [loadOrders, ordersState.loading, ordersState.supported]);

    useEffect(() => {
        if (!token) return undefined;

        const controller = new AbortController();
        const loadDevices = async () => {
            setLoadingDevices(true);
            setDevicesError(null);
            try {
                const payload = await fetchMyDevices(token, {
                    signal: controller.signal,
                    onUnauthorized: redirectToLogin,
                });
                if (payload === null) return;
                setDevices(normalizeDevices(payload));
            } catch (error) {
                if (error?.name === 'AbortError') return;
                setDevicesError(error?.message || 'Failed to load devices');
            } finally {
                setLoadingDevices(false);
            }
        };

        loadDevices();
        return () => controller.abort();
    }, [redirectToLogin, token]);

    const latestTelemetry = useMemo(() => {
        const timestamps = devices
            .map((device) => Date.parse(device.lastSeen))
            .filter((value) => Number.isFinite(value));
        if (!timestamps.length) return null;
        return new Date(Math.max(...timestamps)).toLocaleString();
    }, [devices]);

    const activeAlerts = useMemo(() => {
        const numbers = devices
            .map((device) => {
                if (Array.isArray(device.activeAlerts)) return device.activeAlerts.length;
                if (device.activeAlerts == null) return null;
                const numeric = Number(device.activeAlerts);
                return Number.isFinite(numeric) ? numeric : null;
            })
            .filter((value) => value != null);
        if (!numbers.length) return null;
        return numbers.reduce((total, value) => total + value, 0);
    }, [devices]);

    const summaryTiles = useMemo(() => {
        const tiles = [
            { label: 'Devices', value: devices.length || '0' },
        ];
        if (activeAlerts != null) {
            tiles.push({ label: 'Active alerts', value: activeAlerts });
        }
        if (latestTelemetry) {
            tiles.push({ label: 'Last telemetry', value: latestTelemetry });
        }
        return tiles;
    }, [activeAlerts, devices.length, latestTelemetry]);

    return (
        <div className={styles.grid}>
            <section className={styles.summary}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h2>Overview</h2>
                        <p>Quick status for your account and devices.</p>
                    </div>
                    {ordersState.supported ? (
                        <Link to="/my-page/orders" className={styles.linkButton}>
                            Orders
                        </Link>
                    ) : null}
                </div>
                <div className={styles.tiles}>
                    {summaryTiles.map((tile) => (
                        <div key={tile.label} className={styles.tile}>
                            <p className={styles.tileLabel}>{tile.label}</p>
                            <p className={styles.tileValue}>{tile.value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className={styles.devices}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h2>My devices</h2>
                        <p>Live status, key metrics, and quick access.</p>
                    </div>
                </div>

                {loadingDevices ? (
                    <div className={styles.loading}>Loading devices…</div>
                ) : devicesError ? (
                    <div className={styles.error} role="alert">
                        <div>{devicesError}</div>
                        <button type="button" onClick={() => window.location.reload()}>
                            Retry
                        </button>
                    </div>
                ) : devices.length === 0 ? (
                    <div className={styles.empty}>
                        <p>You do not have any devices yet…</p>
                        <p className={styles.emptySub}>Visit the store to add your first device.</p>
                        <div className={styles.emptyActions}>
                            <Link to="/store" className={styles.primaryButton}>Browse store</Link>
                        </div>
                    </div>
                ) : (
                    <div className={styles.deviceGrid}>
                        {devices.map((device) => {
                            const metrics = deriveMetrics(device);
                            const lastSeen = formatDateTime(device.lastSeen);
                            return (
                                <div key={device.id} className={styles.deviceCard}>
                                    <div className={styles.deviceHeader}>
                                        <div>
                                            <p className={styles.deviceName}>{device.name}</p>
                                            <p className={styles.deviceId}>ID: {device.id}</p>
                                        </div>
                                        <div className={styles.deviceStatus}>
                                            <span className={`${styles.statusBadge} ${statusClassName(device.status)}`}>
                                                {String(device.status || '').toUpperCase()}
                                            </span>
                                            {lastSeen && <span className={styles.metaText}>Last update: {lastSeen}</span>}
                                        </div>
                                    </div>

                                    <div className={styles.metricsRow}>
                                        {metrics.length ? (
                                            metrics.map((metric) => (
                                                <span key={metric.label} className={styles.metricChip}>
                                                    <span className={styles.metricLabel}>{metric.label}</span>
                                                    <span className={styles.metricValue}>{metric.display}</span>
                                                </span>
                                            ))
                                        ) : (
                                            <span className={styles.metaText}>No data available.</span>
                                        )}
                                    </div>

                                    <DeviceCard
                                        id={device.name}
                                        compositeId={device.id}
                                        sensors={device.sensors}
                                        tempC={device.metrics.tempC ?? device.metrics.temperature}
                                        humidityPct={device.metrics.humidity}
                                        co2ppm={device.metrics.co2}
                                    />

                                    <div className={styles.deviceActions}>
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => navigate(`/my-page/devices/${encodeURIComponent(device.id)}`)}
                                        >
                                            Details
                                        </button>
                                        {reportsEnabled ? (
                                            <Link
                                                to={`/dashboard/reports?deviceId=${encodeURIComponent(device.id)}`}
                                                className={styles.ghostButton}
                                            >
                                                Reports
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className={styles.account}>
                <h2>Account</h2>
                <div className={styles.accountGrid}>
                    <div className={styles.field}>
                        <label>Display name</label>
                        <div className={styles.readonly}>{loadingProfile ? 'Loading…' : profile?.displayName || '—'}</div>
                    </div>
                    <div className={styles.field}>
                        <label>Email</label>
                        <div className={styles.readonly}>{loadingProfile ? 'Loading…' : profile?.email || '—'}</div>
                    </div>
                </div>
                <div className={styles.accountActions}>
                    {ordersState.supported ? (
                        <Link to="/my-page/orders" className={styles.linkButton}>
                            My orders
                        </Link>
                    ) : null}
                    <button type="button" className={styles.dangerButton} onClick={() => logout()}>
                        Sign out
                    </button>
                </div>
            </section>
        </div>
    );
}
