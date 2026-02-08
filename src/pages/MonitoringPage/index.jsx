import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { authFetch, parseApiResponse } from "../../api/http.js";
import { getMonitoringPageBySlug } from "../../api/monitoringPages.js";
import { getApiBaseUrl } from "../../config/apiBase.js";
import Header from "../common/Header";
import { WS_TOPICS } from "../common/dashboard.constants.js";
import { useLiveDevices } from "../common/useLiveDevices.js";
import RackDashboardView from "../RackDashboard/RackDashboardView.jsx";
import { resolveDeviceSelectionKey } from "../RackDashboard/rackTelemetry.js";
import styles from "./MonitoringPage.module.css";

const API_BASE = getApiBaseUrl();
// TODO: confirm telemetry device list endpoint + DTO name for monitoring pages.
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

const formatUptime = (uptimeSeconds) => {
    if (!Number.isFinite(uptimeSeconds)) return null;
    if (uptimeSeconds < 60) return `${Math.floor(uptimeSeconds)}s`;
    const minutes = Math.floor(uptimeSeconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(uptimeSeconds / 3600);
    if (hours < 24) {
        const remainingMinutes = Math.floor((uptimeSeconds % 3600) / 60);
        return `${hours}h ${remainingMinutes}m`;
    }
    const days = Math.floor(uptimeSeconds / 86400);
    const remainingHours = Math.floor((uptimeSeconds % 86400) / 3600);
    return `${days}d ${remainingHours}h`;
};

const resolveBootSignature = (device) => ({
    // TODO: confirm boot signature field names from telemetry/device DTOs (bootId/bootTime).
    bootId: device?.bootId ?? device?.boot_id ?? null,
    bootTime: device?.bootTime ?? device?.boot_time ?? null,
});

const resolveLiveUptimeSeconds = (device) => {
    // TODO: confirm live telemetry uptimeSeconds field location (payload vs extra).
    return device?.uptimeSeconds ?? device?.extra?.uptimeSeconds ?? null;
};

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
    const [commandToken, setCommandToken] = useState(() => {
        try {
            return window.localStorage.getItem("monitoringCommandToken") || "";
        } catch {
            return "";
        }
    });
    const [resetStateByDevice, setResetStateByDevice] = useState({});
    const [resettingDevices, setResettingDevices] = useState(() => new Set());
    const [toastMessage, setToastMessage] = useState("");
    // English comment: Local-only selection (no persistence).
    const [selectedDeviceIds, setSelectedDeviceIds] = useState(() => new Set());
    const missingTarget = Boolean(
        (!target.farm || !target.unitType || !target.unitId) && !pageLoading && !pageNotFound && !pageError,
    );
    const targetKey = useMemo(() => buildTargetKey(target), [target]);
    const liveScope = useMemo(
        () => ({
            farmId: target.farm,
            unitType: target.unitType,
            unitId: target.unitId,
            // TODO: confirm if subUnitId maps to layerId for live telemetry scoping.
            layerId: target.subUnitId,
        }),
        [target],
    );
    const { mergedDevices } = useLiveDevices(WS_TOPICS, { scope: liveScope });

    useEffect(() => {
        if (!toastMessage) return undefined;
        const timeout = window.setTimeout(() => {
            setToastMessage("");
        }, 3500);
        return () => window.clearTimeout(timeout);
    }, [toastMessage]);

    useEffect(() => {
        try {
            window.localStorage.setItem("monitoringCommandToken", commandToken);
        } catch {
            // Ignore storage write failures.
        }
    }, [commandToken]);

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

    useEffect(() => {
        if (!mergedDevices || devices.length === 0) return;
        setDevices((prev) => {
            let changed = false;
            const next = prev.map((device) => {
                const key = resolveDeviceKey(device);
                if (!key) return device;
                const live = mergedDevices[key];
                if (!live) return device;
                const liveUptimeSeconds = resolveLiveUptimeSeconds(live);
                const liveBoot = resolveBootSignature(live?.extra || live);
                let updated = device;
                if (liveUptimeSeconds !== null && liveUptimeSeconds !== device?.uptimeSeconds) {
                    updated = { ...updated, uptimeSeconds: liveUptimeSeconds };
                    changed = true;
                }
                if (liveBoot.bootId !== null && liveBoot.bootId !== device?.bootId) {
                    updated = { ...updated, bootId: liveBoot.bootId };
                    changed = true;
                }
                if (liveBoot.bootTime !== null && liveBoot.bootTime !== device?.bootTime) {
                    updated = { ...updated, bootTime: liveBoot.bootTime };
                    changed = true;
                }
                return updated;
            });
            return changed ? next : prev;
        });
    }, [devices, mergedDevices]);

    useEffect(() => {
        if (!mergedDevices) return;
        setResetStateByDevice((prev) => {
            let changed = false;
            const next = { ...prev };
            Object.entries(prev).forEach(([deviceKey, state]) => {
                if (state?.status !== "requested") return;
                const live = mergedDevices[deviceKey];
                if (!live) return;
                const liveBoot = resolveBootSignature(live?.extra || live);
                const hasLiveBoot = liveBoot.bootId !== null || liveBoot.bootTime !== null;
                if (!hasLiveBoot) return;
                const bootIdChanged =
                    liveBoot.bootId !== null && liveBoot.bootId !== state?.bootId;
                const bootTimeChanged =
                    liveBoot.bootTime !== null && liveBoot.bootTime !== state?.bootTime;
                if (bootIdChanged || bootTimeChanged) {
                    next[deviceKey] = { ...state, status: "" };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [mergedDevices]);

    useEffect(() => {
        if (!commandToken.trim()) return;
        setResetStateByDevice((prev) => {
            let changed = false;
            const next = { ...prev };
            Object.entries(prev).forEach(([deviceKey, state]) => {
                if (state?.error !== "Token required") return;
                next[deviceKey] = { ...state, error: "" };
                changed = true;
            });
            return changed ? next : prev;
        });
    }, [commandToken]);

    const handleResetClick = async (device, index) => {
        const deviceKey = resolveDeviceKey(device);
        if (!deviceKey) return;
        const trimmedToken = commandToken.trim();
        if (!trimmedToken) {
            setResetStateByDevice((prev) => ({
                ...prev,
                [deviceKey]: { ...prev[deviceKey], error: "Token required" },
            }));
            return;
        }
        const deviceLabel = resolveDeviceLabel(device, index);
        const shouldProceed = window.confirm(`Reset device ${deviceLabel}?`);
        if (!shouldProceed) return;

        // TODO: confirm device reset endpoint and device id field from monitoring device DTO.
        // TODO: confirm command transport (MQTT topic/QoS/client) if reset should route elsewhere.
        const deviceId = device?.deviceId ?? device?.id ?? null;
        if (!deviceId) {
            setResetStateByDevice((prev) => ({
                ...prev,
                [deviceKey]: { ...prev[deviceKey], error: "Device ID missing" },
            }));
            return;
        }

        const currentBoot = resolveBootSignature(mergedDevices?.[deviceKey]?.extra || device);

        setResettingDevices((prev) => new Set(prev).add(deviceKey));
        setResetStateByDevice((prev) => ({
            ...prev,
            [deviceKey]: { ...prev[deviceKey], error: "" },
        }));

        try {
            const response = await fetch(
                `${API_BASE}/api/devices/${encodeURIComponent(deviceId)}/reset`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${trimmedToken}`,
                    },
                },
            );

            if (response.status === 401) {
                setResetStateByDevice((prev) => ({
                    ...prev,
                    [deviceKey]: { ...prev[deviceKey], error: "Unauthorized (invalid token)" },
                }));
                return;
            }

            if (!response.ok) {
                setResetStateByDevice((prev) => ({
                    ...prev,
                    [deviceKey]: { ...prev[deviceKey], error: "Unable to request reset" },
                }));
                return;
            }

            setToastMessage("Reset requested");
            setResetStateByDevice((prev) => ({
                ...prev,
                [deviceKey]: {
                    status: "requested",
                    error: "",
                    bootId: currentBoot.bootId,
                    bootTime: currentBoot.bootTime,
                },
            }));
        } catch {
            setResetStateByDevice((prev) => ({
                ...prev,
                [deviceKey]: { ...prev[deviceKey], error: "Unable to request reset" },
            }));
        } finally {
            setResettingDevices((prev) => {
                const next = new Set(prev);
                next.delete(deviceKey);
                return next;
            });
        }
    };

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
                        <label className={styles.tokenField}>
                            <span className={styles.tokenLabel}>Command token</span>
                            <input
                                type="password"
                                className={styles.tokenInput}
                                placeholder="PASTE_TOKEN_HERE"
                                value={commandToken}
                                onChange={(event) => setCommandToken(event.target.value)}
                                autoComplete="off"
                            />
                        </label>
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
                    <>
                        {toastMessage ? (
                            <div className={styles.toast} role="status" aria-live="polite">
                                {toastMessage}
                            </div>
                        ) : null}
                        <div className={styles.deviceHeader}>
                            <span className={styles.deviceHeaderLabel}>Device</span>
                            <span className={styles.deviceHeaderLabel}>Type</span>
                            <span className={styles.deviceHeaderLabel}>Uptime</span>
                            <span className={styles.deviceHeaderLabel}>Reset</span>
                        </div>
                        <ul className={styles.deviceList}>
                            {devices.map((device, index) => {
                                const selectionId = resolveDeviceKey(device);
                                const id = resolveDeviceRowKey(device, index, targetKey);
                                const checked = selectionId ? selectedDeviceIds.has(selectionId) : false;
                                const uptimeLabel = formatUptime(device?.uptimeSeconds);
                                const resetState = selectionId ? resetStateByDevice[selectionId] : null;
                                const isResetting = selectionId ? resettingDevices.has(selectionId) : false;

                                return (
                                    <li key={id} className={styles.deviceItem}>
                                        <div className={styles.deviceRow}>
                                            <label className={styles.deviceIdentity}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.deviceCheckbox}
                                                    checked={checked}
                                                    onChange={() => toggleDeviceSelection(selectionId)}
                                                    disabled={!selectionId}
                                                />
                                                <span className={styles.deviceName}>
                                                    {resolveDeviceLabel(device, index)}
                                                </span>
                                            </label>
                                            <span className={styles.deviceMeta}>
                                                {device?.type || device?.model || device?.category || "Device"}
                                            </span>
                                            <span
                                                className={styles.deviceUptime}
                                                title={uptimeLabel ? undefined : "Uptime unknown"}
                                            >
                                                {uptimeLabel || "—"}
                                            </span>
                                            <div className={styles.resetColumn}>
                                                <button
                                                    type="button"
                                                    className={styles.resetButton}
                                                    onClick={() => handleResetClick(device, index)}
                                                    disabled={isResetting}
                                                >
                                                    {isResetting ? "Resetting..." : "Reset"}
                                                </button>
                                                {resetState?.status === "requested" ? (
                                                    <span className={styles.resetRequested}>Reset requested</span>
                                                ) : null}
                                            </div>
                                        </div>
                                        {resetState?.error ? (
                                            <div className={styles.resetError}>{resetState.error}</div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
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
