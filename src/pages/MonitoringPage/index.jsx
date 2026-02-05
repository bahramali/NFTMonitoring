import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { authFetch, parseApiResponse } from "../../api/http.js";
import { getMonitoringPageBySlug } from "../../api/monitoringPages.js";
import { getApiBaseUrl } from "../../config/apiBase.js";
import Header from "../common/Header";
import RackDashboardView from "../RackDashboard/RackDashboardView.jsx";
import { resolveDeviceSelectionKey } from "../RackDashboard/rackTelemetry.js";
import styles from "./MonitoringPage.module.css";

const API_BASE = getApiBaseUrl();
const TELEMETRY_DEVICES_URL = `${API_BASE}/api/telemetry-targets/devices`;

/**
 * @typedef {Object} MonitoringPage
 * @property {string} [title]
 * @property {string} [name]
 * @property {string} [pageTitle]
 * @property {string} [displayName]
 * @property {string} [farm]
 * @property {string} [unitType]
 * @property {string} [unitId]
 * @property {string} [subUnitType]
 * @property {string} [subUnitId]
 * @property {Object} [target]
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
const resolveTargetValue = (source, keys) => {
    if (!source) return "";
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && String(value).trim()) {
            return String(value).trim();
        }
    }
    return "";
};

const normalizeUnitType = (value) => `${value || ""}`.trim().toUpperCase();

/**
 * @param {MonitoringPage | null | undefined} pageData
 */
const resolveTarget = (pageData) => {
    const containers = [pageData, pageData?.target, pageData?.telemetryTarget, pageData?.telemetry_target];
    const resolveFromContainers = (keys) => {
        for (const container of containers) {
            const value = resolveTargetValue(container, keys);
            if (value) return value;
        }
        return "";
    };

    return {
        farm: resolveFromContainers(["farm", "system", "site", "farmId", "systemId", "siteId"]),
        unitType: normalizeUnitType(resolveFromContainers(["unitType", "unit_type", "type", "unit"])),
        unitId: resolveFromContainers(["unitId", "unit_id", "unit"]),
        subUnitType: normalizeUnitType(resolveFromContainers(["subUnitType", "sub_unit_type", "subUnit"])),
        subUnitId: resolveFromContainers(["subUnitId", "sub_unit_id", "subUnitId", "sub_unit"]),
    };
};

const formatTargetLabel = (target) => {
    if (!target?.unitType || !target?.unitId) return "Not configured";
    const parts = [`${target.unitType} ${target.unitId}`];
    if (target.subUnitType && target.subUnitId) {
        parts.push(`${target.subUnitType} ${target.subUnitId}`);
    }
    return parts.join(" • ");
};

const buildTargetKey = (target) =>
    [target?.farm, target?.unitType, target?.unitId, target?.subUnitType, target?.subUnitId]
        .filter(Boolean)
        .join("-");

const buildTargetQuery = (target) => {
    const query = new URLSearchParams();
    if (target.farm) query.set("farm", target.farm);
    if (target.unitType) query.set("unitType", target.unitType);
    if (target.unitId) query.set("unitId", target.unitId);
    if (target.subUnitType) query.set("subUnitType", target.subUnitType);
    if (target.subUnitId) query.set("subUnitId", target.subUnitId);
    return query.toString();
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
        resolveDeviceSelectionKey(device),
        device?.id,
        device?.nodeId,
        device?.serial,
        device?.name,
        device?.label,
        device?.displayName,
    ];
    const value = candidates.find((candidate) => candidate !== undefined && candidate !== null);
    if (value) return String(value);
    return `ID ${index + 1}`;
};

// English comment: Stable device identifier aligned with live telemetry identity.
const resolveDeviceKey = (device) => resolveDeviceSelectionKey(device);

const resolveDeviceRowKey = (device, index, targetKey) =>
    resolveDeviceSelectionKey(device) || `${targetKey || "target"}-${index}`;

export default function MonitoringPage() {
    const { slug } = useParams();
    const normalizedSlug = useMemo(() => String(slug ?? "").trim(), [slug]);
    const [pageData, setPageData] = useState(null);
    const [target, setTarget] = useState({
        farm: "",
        unitType: "",
        unitId: "",
        subUnitType: "",
        subUnitId: "",
    });
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [pageNotFound, setPageNotFound] = useState(false);

    const [devices, setDevices] = useState([]);
    const [devicesLoading, setDevicesLoading] = useState(false);
    const [devicesError, setDevicesError] = useState("");
    // English comment: Local-only selection (no persistence).
    const [selectedDeviceIds, setSelectedDeviceIds] = useState(() => new Set());
    const missingTarget = Boolean(
        (!target.farm || !target.unitType || !target.unitId) && !pageLoading && !pageNotFound && !pageError,
    );
    const targetKey = useMemo(() => buildTargetKey(target), [target]);

    useEffect(() => {
        if (!normalizedSlug) {
            setPageError("Missing page slug.");
            setPageLoading(false);
            setPageNotFound(false);
            setPageData(null);
            setTarget({ farm: "", unitType: "", unitId: "", subUnitType: "", subUnitId: "" });
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        const loadPage = async () => {
            setPageLoading(true);
            setPageError("");
            setPageNotFound(false);
            setPageData(null);
            setTarget({ farm: "", unitType: "", unitId: "", subUnitType: "", subUnitId: "" });

            try {
                const data = await getMonitoringPageBySlug(normalizedSlug, { signal: controller.signal });
                if (cancelled) return;
                setPageData(data);
                setTarget(resolveTarget(data));
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
                setTarget({ farm: "", unitType: "", unitId: "", subUnitType: "", subUnitId: "" });
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
        if (!target.farm || !target.unitType || !target.unitId) {
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
                const query = buildTargetQuery(target);
                const response = await authFetch(
                    `${TELEMETRY_DEVICES_URL}?${query}`,
                    { signal: controller.signal },
                );
                const payload = await parseApiResponse(response, "Unable to load telemetry devices");
                if (cancelled) return;
                setDevices(resolveDeviceList(payload));
            } catch (error) {
                if (cancelled || controller.signal.aborted) return;
                console.error("Failed to load telemetry devices", error);
                setDevicesError("Unable to load devices for this target.");
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
    }, [target]);

    useEffect(() => {
        if (!missingTarget) return;
        console.warn(
            "Telemetry target is missing required fields (farm, unitType, unitId). Devices will remain empty until configured.",
        );
    }, [missingTarget]);

    // English comment: Auto-select all devices after devices list loads.
    useEffect(() => {
        if (!devices || devices.length === 0) {
            setSelectedDeviceIds(new Set());
            return;
        }
        const all = new Set(
            devices
                .map((device) => resolveDeviceKey(device))
                .filter((value) => value),
        );
        setSelectedDeviceIds(all);
    }, [devices, targetKey]);

    // English comment: Toggle selection by device id.
    const toggleDeviceSelection = (id) => {
        if (!id) return;
        setSelectedDeviceIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // English comment: Convenience actions.
    const selectAllDevices = () => {
        const all = new Set(
            devices
                .map((device) => resolveDeviceKey(device))
                .filter((value) => value),
        );
        setSelectedDeviceIds(all);
    };
    const clearAllDevices = () => setSelectedDeviceIds(new Set());

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
                    <span className={styles.label}>Telemetry target</span>
                    <span className={styles.value}>{formatTargetLabel(target)}</span>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.label}>Farm</span>
                    <span className={styles.value}>{target.farm || "Not configured"}</span>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.label}>Unit type</span>
                    <span className={styles.value}>{target.unitType || "Not configured"}</span>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.label}>Unit ID</span>
                    <span className={styles.value}>{target.unitId || "Not configured"}</span>
                </div>
                {target.subUnitType || target.subUnitId ? (
                    <div className={styles.metaRow}>
                        <span className={styles.label}>Sub-unit</span>
                        <span className={styles.value}>
                            {target.subUnitType && target.subUnitId
                                ? `${target.subUnitType} ${target.subUnitId}`
                                : "Not configured"}
                        </span>
                    </div>
                ) : null}
                {pageLoading && <p className={styles.statusMessage}>Loading page configuration…</p>}
                {pageNotFound && <p className={styles.statusMessage}>Page not found.</p>}
                {pageError && <p className={styles.statusMessage}>{pageError}</p>}
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Devices</h2>
                    <div className={styles.sectionActions}>
                        <span className={styles.sectionMeta}>{devices.length} total</span>
                        <button
                            type="button"
                            className={`${styles.sectionButton} ${styles.actionButton}`}
                            onClick={selectAllDevices}
                            disabled={devices.length === 0}
                        >
                            Select all
                        </button>
                        <button
                            type="button"
                            className={`${styles.sectionButton} ${styles.actionButton}`}
                            onClick={clearAllDevices}
                            disabled={devices.length === 0}
                        >
                            Clear
                        </button>
                    </div>
                </div>
                {missingTarget && (
                    <div className={styles.warningBox}>
                        <p className={styles.warningTitle}>Telemetry target incomplete</p>
                        <p className={styles.warningMessage}>
                            This page is missing required target details (farm, unit type, unit ID), so devices and
                            telemetry cannot load yet.
                        </p>
                    </div>
                )}
                {devicesLoading && <p className={styles.statusMessage}>Loading devices…</p>}
                {devicesError && <p className={styles.statusMessage}>{devicesError}</p>}
                {!devicesLoading && !devicesError && !missingTarget && devices.length === 0 && (
                    <p className={styles.statusMessage}>No devices found for this target.</p>
                )}
                {!devicesLoading && !devicesError && devices.length > 0 && (
                    <ul className={styles.deviceList}>
                        {devices.map((device, index) => {
                            const selectionId = resolveDeviceKey(device);
                            const id = resolveDeviceRowKey(device, index, targetKey);
                            const checked = selectionId ? selectedDeviceIds.has(selectionId) : false;

                            return (
                                <li key={id} className={styles.deviceItem}>
                                    <label className={styles.deviceRow}>
                                        <input
                                            type="checkbox"
                                            className={styles.deviceCheckbox}
                                            checked={checked}
                                            onChange={() => toggleDeviceSelection(selectionId)}
                                            disabled={!selectionId}
                                        />
                                        <span className={styles.deviceName}>{resolveDeviceLabel(device, index)}</span>
                                        <span className={styles.deviceMeta}>
                                            {device?.type || device?.model || device?.category || "Device"}
                                        </span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {target.unitType === "RACK" && target.unitId ? (
                <RackDashboardView
                    rackId={target.unitId}
                    selectedDeviceIds={Array.from(selectedDeviceIds)}
                />
            ) : null}
        </div>
    );
}
