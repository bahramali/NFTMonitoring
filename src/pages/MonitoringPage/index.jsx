import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { authFetch, parseApiResponse } from "../../api/http.js";
import { getMonitoringPageBySlug } from "../../api/monitoringPages.js";
import { getApiBaseUrl } from "../../config/apiBase.js";
import Header from "../common/Header";
import RackDashboardView from "../RackDashboard/RackDashboardView.jsx";
import styles from "./MonitoringPage.module.css";

const API_BASE = getApiBaseUrl();

/**
 * @typedef {Object} MonitoringPage
 * @property {string} [title]
 * @property {string} [name]
 * @property {string} [pageTitle]
 * @property {string} [displayName]
 * @property {string} [rackId]
 * @property {string} [rack_id]
 * @property {string | {id?: string, rackId?: string, rack_id?: string, rack?: string}} [rack]
 * @property {string} [telemetryRackId]
 * @property {string} [telemetry_rack_id]
 * @property {string | {id?: string, rackId?: string, rack_id?: string, rack?: string}} [telemetryRack]
 * @property {string} [telemetry_rack]
 */

/**
 * @param {MonitoringPage | null | undefined} pageData
 */
const resolvePageTitle = (pageData) => {
    const candidates = [
        pageData?.title,
        pageData?.name,
        pageData?.pageTitle,
        pageData?.displayName,
    ];
    return candidates.find((value) => typeof value === "string" && value.trim()) || "Monitoring Page";
};

/**
 * @param {MonitoringPage | null | undefined} pageData
 */
const resolveRackId = (pageData) => {
    const candidates = [
        pageData?.rackId,
        pageData?.rack_id,
        pageData?.rack,
        pageData?.rack?.id,
        pageData?.rack?.rackId,
        pageData?.rack?.rack_id,
        pageData?.rack?.rack,
    ];
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const value = String(candidate).trim();
        if (value) return value;
    }
    return "";
};

/**
 * @param {MonitoringPage | null | undefined} pageData
 */
const resolveTelemetryRackId = (pageData) => {
    const candidates = [
        pageData?.telemetryRackId,
        pageData?.telemetry_rack_id,
        pageData?.telemetryRack,
        pageData?.telemetry_rack,
        pageData?.telemetryRack?.id,
        pageData?.telemetryRack?.rackId,
        pageData?.telemetryRack?.rack_id,
        pageData?.telemetryRack?.rack,
    ];
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const value = String(candidate).trim();
        if (value) return value;
    }
    return "";
};

const resolveDeviceList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.nodes)) return payload.nodes;
    if (Array.isArray(payload?.devices)) return payload.devices;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.nodes)) return payload.data.nodes;
    if (Array.isArray(payload?.data?.devices)) return payload.data.devices;
    return [];
};

const resolveDeviceLabel = (device, index) => {
    const candidates = [
        device?.name,
        device?.label,
        device?.displayName,
        device?.id,
        device?.nodeId,
        device?.serial,
    ];
    const value = candidates.find((candidate) => candidate !== undefined && candidate !== null);
    if (value) return String(value);
    return `Device ${index + 1}`;
};

export default function MonitoringPage() {
    const { slug } = useParams();
    const normalizedSlug = useMemo(() => String(slug ?? "").trim(), [slug]);
    const [pageData, setPageData] = useState(null);
    const [rackId, setRackId] = useState("");
    const [telemetryRackId, setTelemetryRackId] = useState("");
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [pageNotFound, setPageNotFound] = useState(false);

    const [devices, setDevices] = useState([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [devicesError, setDevicesError] = useState("");

    useEffect(() => {
        if (!normalizedSlug) {
            setPageError("Missing page slug.");
            setPageLoading(false);
            setPageNotFound(false);
            setPageData(null);
            setRackId("");
            setTelemetryRackId("");
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        const loadPage = async () => {
            setPageLoading(true);
            setPageError("");
            setPageNotFound(false);
            setPageData(null);
            setRackId("");
            setTelemetryRackId("");

            try {
                const data = await getMonitoringPageBySlug(normalizedSlug, { signal: controller.signal });
                if (cancelled) return;
                setPageData(data);
                setRackId(resolveRackId(data));
                setTelemetryRackId(resolveTelemetryRackId(data));
            } catch (error) {
                if (cancelled || controller.signal.aborted) return;
                if (error?.status === 404) {
                    setPageNotFound(true);
                    setPageError("");
                } else {
                    console.error("Failed to load monitoring page", error);
                    setPageError("Unable to load this monitoring page.");
                }
                setPageData(null);
                setRackId("");
                setTelemetryRackId("");
            } finally {
                if (!cancelled) {
                    setPageLoading(false);
                }
            }
        };

        loadPage();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [normalizedSlug]);

    useEffect(() => {
        if (!telemetryRackId) {
            setDevices([]);
            setDevicesLoading(false);
            setDevicesError("");
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        const loadDevices = async () => {
            setDevicesLoading(true);
            setDevicesError("");
            try {
                const response = await authFetch(
                    `${API_BASE}/api/racks/${encodeURIComponent(telemetryRackId)}/nodes`,
                    { signal: controller.signal },
                );
                const payload = await parseApiResponse(response, "Unable to load rack devices");
                if (cancelled) return;
                setDevices(resolveDeviceList(payload));
            } catch (error) {
                if (cancelled || controller.signal.aborted) return;
                console.error("Failed to load rack devices", error);
                setDevicesError("Unable to load devices for this rack.");
                setDevices([]);
            } finally {
                if (!cancelled) {
                    setDevicesLoading(false);
                }
            }
        };

        loadDevices();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [telemetryRackId]);

    const title = resolvePageTitle(pageData);

    return (
        <div className={styles.page}>
            <Header title={title} />
            <section className={styles.card}>
                <div className={styles.metaRow}>
                    <span className={styles.label}>Slug</span>
                    <span className={styles.value}>{normalizedSlug || "—"}</span>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.label}>Rack</span>
                    <span className={styles.value}>{rackId || "Not configured"}</span>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.label}>Telemetry rack</span>
                    <span className={styles.value}>{telemetryRackId || "Not configured"}</span>
                </div>
                {pageLoading && <p className={styles.statusMessage}>Loading page configuration…</p>}
                {pageNotFound && <p className={styles.statusMessage}>Page not found.</p>}
                {pageError && <p className={styles.statusMessage}>{pageError}</p>}
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Devices</h2>
                    <span className={styles.sectionMeta}>{devices.length} total</span>
                </div>
                {!telemetryRackId && !pageLoading && !pageNotFound && (
                    <p className={styles.statusMessage}>Telemetry rack configuration is missing for this page.</p>
                )}
                {devicesLoading && <p className={styles.statusMessage}>Loading devices…</p>}
                {devicesError && <p className={styles.statusMessage}>{devicesError}</p>}
                {!devicesLoading && !devicesError && telemetryRackId && devices.length === 0 && (
                    <p className={styles.statusMessage}>No devices found for this rack.</p>
                )}
                {!devicesLoading && !devicesError && devices.length > 0 && (
                    <ul className={styles.deviceList}>
                        {devices.map((device, index) => (
                            <li
                                key={
                                    device?.id ??
                                    device?.nodeId ??
                                    `${telemetryRackId || rackId}-${index}`
                                }
                                className={styles.deviceItem}
                            >
                                <span className={styles.deviceName}>{resolveDeviceLabel(device, index)}</span>
                                <span className={styles.deviceMeta}>
                                    {device?.type || device?.model || device?.category || "Device"}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {telemetryRackId && <RackDashboardView rackId={telemetryRackId} />}
        </div>
    );
}
