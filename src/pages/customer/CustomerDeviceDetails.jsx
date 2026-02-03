import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import DeviceCard from '../Overview/components/DeviceCard.jsx';
import { fetchDeviceDetails } from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import styles from './CustomerDeviceDetails.module.css';

const normalizeDevice = (payload = {}) => {
    const device = payload?.device ?? payload;
    const id = device.id ?? device.deviceId ?? device.serialNumber ?? device.compositeId;
    const lastSeen =
        device.lastSeen ??
        device.lastTelemetry ??
        device.lastTelemetryAt ??
        device.lastUpdate ??
        device.updatedAt ??
        device.timestamp;
    const statusRaw = device.status ?? device.state ?? device.online;
    const status =
        typeof statusRaw === 'boolean' ? (statusRaw ? 'ONLINE' : 'OFFLINE') : statusRaw || 'UNKNOWN';
    const metrics = device.metrics ?? device.latest ?? device.telemetry ?? {};

    return {
        id,
        name: device.name ?? device.displayName ?? device.deviceName ?? id ?? 'Device',
        status,
        lastSeen,
        telemetry: {
            air_temp_c: metrics.air_temp_c ?? metrics.tempC ?? metrics.temperature,
            rh_pct: metrics.rh_pct ?? metrics.humidity ?? metrics.rh,
            co2_ppm: metrics.co2_ppm ?? metrics.co2,
            lux: metrics.lux ?? metrics.light,
            as7343_counts: metrics.as7343_counts ?? metrics.spectral,
        },
        health: device.health ?? device.sensorHealth ?? device.sensorsHealth ?? {},
        uptime: device.uptime ?? device.uptime_human ?? '',
        deviceType: device.deviceType ?? device.type ?? device.model ?? device.category ?? '',
        location: device.location ?? device.site ?? device.room ?? '',
        alerts: device.activeAlerts ?? device.alertsActive ?? device.alerts ?? [],
        raw: device,
    };
};

const formatDateTime = (value) => {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString();
};

const statusClassName = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'ONLINE') return styles.statusOnline;
    if (normalized === 'OFFLINE') return styles.statusOffline;
    return styles.statusUnknown;
};

export default function CustomerDeviceDetails() {
    const { deviceId } = useParams();
    const { token } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const { profile } = useOutletContext();

    const [device, setDevice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const reportsEnabled = useMemo(() => {
        const envFlag = import.meta.env?.VITE_CUSTOMER_REPORTS === 'true';
        const featureFlag = Array.isArray(profile?.features) && profile.features.includes('CUSTOMER_REPORTS');
        return envFlag || featureFlag;
    }, [profile?.features]);

    useEffect(() => {
        if (!deviceId || !token) return undefined;

        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const payload = await fetchDeviceDetails(token, deviceId, {
                    signal: controller.signal,
                    onUnauthorized: redirectToLogin,
                });
                if (payload === null) return;
                setDevice(normalizeDevice(payload));
            } catch (err) {
                if (err?.name === 'AbortError') return;
                setError(err?.message || 'Failed to load device details');
            } finally {
                setLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [deviceId, redirectToLogin, token]);

    const alertCount = useMemo(() => {
        if (!device?.alerts) return 0;
        if (Array.isArray(device.alerts)) return device.alerts.length;
        const numeric = Number(device.alerts);
        return Number.isFinite(numeric) ? numeric : 0;
    }, [device?.alerts]);

    return (
        <div className={styles.page}>
            <div className={styles.breadcrumbs}>
                <Link to="/account">My account</Link>
                <span>/</span>
                <span className={styles.current}>{device?.name ?? deviceId ?? 'Device details'}</span>
            </div>

            {loading ? (
                <div className={styles.loading}>Loading device details…</div>
            ) : error ? (
                <div className={styles.error} role="alert">
                    <p>{error}</p>
                    <Link to="/account" className={styles.primaryButton}>Back</Link>
                </div>
            ) : device ? (
                <div className={styles.card}>
                    <div className={styles.header}>
                        <div>
                            <p className={styles.kicker}>Customer device</p>
                            <h1 className={styles.title}>{device.name}</h1>
                            <p className={styles.subtitle}>
                                {profile?.email ? `Owned by ${profile.email}` : 'Owned by you'}
                            </p>
                        </div>
                        <div className={styles.statusBlock}>
                            <span className={`${styles.statusBadge} ${statusClassName(device.status)}`}>
                                {String(device.status || '').toUpperCase()}
                            </span>
                            {device.lastSeen && (
                                <span className={styles.metaText}>
                                    Last update:
                                    {' '}
                                    {formatDateTime(device.lastSeen)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <span className={styles.label}>ID</span>
                            <span className={styles.value}>{device.id || '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.label}>Location</span>
                            <span className={styles.value}>{device.location || '—'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.label}>Alerts</span>
                            <span className={styles.value}>{alertCount}</span>
                        </div>
                    </div>

                    <DeviceCard
                        device={{
                            deviceId: device.id,
                            deviceType: device.deviceType,
                            status: device.status,
                            telemetry: device.telemetry,
                            health: device.health,
                            uptime: device.uptime,
                            farm: device.raw?.farm ?? device.raw?.farmId ?? '',
                            unitType: device.raw?.unitType ?? '',
                            unitId: device.raw?.unitId ?? '',
                            layerId: device.raw?.layerId ?? '',
                        }}
                    />

                    <div className={styles.actions}>
                        <Link to="/account" className={styles.secondaryButton}>Back to account</Link>
                        {reportsEnabled ? (
                            <Link
                                to={`/monitoring/reports?deviceId=${encodeURIComponent(device.id)}`}
                                className={styles.ghostButton}
                            >
                                Reports
                            </Link>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
