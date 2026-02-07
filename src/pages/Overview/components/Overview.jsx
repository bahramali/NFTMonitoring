import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../../common/Header";
import { listDevices } from "../../../api/deviceMonitoring.js";
import { useStomp } from "../../../hooks/useStomp.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { buildDeviceKey, isIdentityComplete, resolveIdentity } from "../../../utils/deviceIdentity.js";
import { WS_TOPICS } from "../../common/dashboard.constants.js";
import {
  DEVICE_KIND_OPTIONS,
  HEALTH_STATUS_ORDER,
  MESSAGE_KIND_OPTIONS,
} from "../../../config/deviceMonitoring.js";
import DeviceStatusBadge from "./DeviceStatusBadge.jsx";
import DeviceFilters from "./DeviceFilters.jsx";
import DeviceDetailsDrawer from "./DeviceDetailsDrawer.jsx";
import JsonStreamViewer from "./JsonStreamViewer.jsx";
import {
  computeDataQuality,
  computeExpectedRatePerMinute,
  evaluateDeviceHealth,
  extractMetricsFromPayload,
  normalizeDeviceKind,
  resolveExpectedConfig,
} from "../utils/deviceHealth.js";
import styles from "./Overview.module.css";

const REFRESH_INTERVAL_MS = 5000;
const STREAM_BUFFER_LIMIT = 20;
const ROW_HEIGHT = 64;

const DEFAULT_FILTERS = {
  farmId: [],
  unitType: [],
  unitId: [],
  layerId: [],
  kind: [],
  status: [],
};

const getTimestampMs = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeLayerId = (value) => {
  if (value === null || value === undefined || value === "") return "NA";
  return String(value).trim() || "NA";
};

const formatAbsoluteTime = (timestamp) => {
  if (!timestamp) return "Never";
  return new Date(timestamp).toLocaleString();
};

const formatRelativeTime = (timestamp, nowMs) => {
  if (!timestamp) return "Never";
  const diff = Math.max(0, nowMs - timestamp);
  if (diff < 1000) return "Just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatLocation = ({ farmId, unitType, unitId, layerId }) =>
  `${farmId || "—"} • ${String(unitType || "").toUpperCase()} ${unitId || "—"} • ${normalizeLayerId(layerId)}`;

const resolveMessageKind = (topic, payloadKind) => {
  const fromTopic = String(topic || "").split("/").pop().toLowerCase();
  if (MESSAGE_KIND_OPTIONS.includes(fromTopic)) return fromTopic;
  const normalized = String(payloadKind || "").toLowerCase();
  if (MESSAGE_KIND_OPTIONS.includes(normalized)) return normalized;
  return "telemetry";
};

const normalizeDevice = (device) => {
  const normalized = {
    farmId: device?.farmId ?? device?.farm_id ?? "",
    unitType: device?.unitType ?? device?.unit_type ?? "",
    unitId: device?.unitId ?? device?.unit_id ?? "",
    layerId: normalizeLayerId(device?.layerId ?? device?.layer_id ?? ""),
    deviceId: device?.deviceId ?? device?.device_id ?? "",
    deviceKind: normalizeDeviceKind(device?.deviceKind ?? device?.device_kind ?? device?.kind ?? device?.type),
    lastSeenMs: getTimestampMs(device?.lastSeen ?? device?.timestamp ?? device?.updatedAt),
    msgTimes: [],
    msgRate: Number.isFinite(device?.msgRate) ? device.msgRate : 0,
    lastMessageKind: "telemetry",
    payloadError: Boolean(device?.payloadError),
    latestMetrics: extractMetricsFromPayload(device?.metrics ?? device?.sensors ?? device?.data ?? {}),
  };

  normalized.key = buildDeviceKey(normalized);
  return normalized;
};

const devicesReducer = (state, action) => {
  switch (action.type) {
    case "seed": {
      return action.payload;
    }
    case "merge": {
      if (action.payload.size === 0) return state;
      const next = new Map(state);
      action.payload.forEach((incoming, key) => {
        const existing = next.get(key);
        if (!existing) {
          next.set(key, incoming);
          return;
        }
        next.set(key, { ...existing, ...incoming });
      });
      return next;
    }
    default:
      return state;
  }
};

const parseList = (value) =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const buildHealthCounts = (devices) =>
  devices.reduce(
    (acc, device) => {
      acc.total += 1;
      acc[device.health.status] = (acc[device.health.status] || 0) + 1;
      return acc;
    },
    { total: 0, ok: 0, degraded: 0, critical: 0, offline: 0 },
  );

export default function Overview() {
  const { role, roles } = useAuth();
  const [devicesMap, dispatchDevices] = useReducer(devicesReducer, new Map());
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState(() => ({
    farmId: parseList(searchParams.get("farm")),
    unitType: parseList(searchParams.get("unitType")),
    unitId: parseList(searchParams.get("unitId")),
    layerId: parseList(searchParams.get("layerId")),
    kind: parseList(searchParams.get("kind")),
    status: parseList(searchParams.get("health")),
  }));
  const [viewMode, setViewMode] = useState(() => searchParams.get("view") ?? "flat");
  const [sortConfig, setSortConfig] = useState({ key: "health", dir: "asc" });
  const [selectedDeviceKey, setSelectedDeviceKey] = useState("");
  const [viewerPaused, setViewerPaused] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [wsBanner, setWsBanner] = useState("");
  const [messageBuffers, setMessageBuffers] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);

  const pendingUpdatesRef = useRef(new Map());
  const rafRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const tableWrapRef = useRef(null);
  const hasLoadedRef = useRef(false);

  const flushPending = useCallback(() => {
    rafRef.current = 0;
    const pending = pendingUpdatesRef.current;
    pendingUpdatesRef.current = new Map();
    dispatchDevices({ type: "merge", payload: pending });
  }, []);

  const queueUpdate = useCallback(
    (key, nextValue) => {
      const existing = pendingUpdatesRef.current.get(key) || {};
      pendingUpdatesRef.current.set(key, { ...existing, ...nextValue });
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(flushPending);
      }
    },
    [flushPending],
  );

  const loadDevices = useCallback(async (signal) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setErrorBanner("");
    try {
      const payload = await listDevices({ signal });
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.devices)
          ? payload.devices
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      const seeded = new Map();
      let hasMissingRequiredFields = false;

      list.forEach((item) => {
        const normalized = normalizeDevice(item);
        if (!normalized.key) {
          hasMissingRequiredFields = true;
          return;
        }
        seeded.set(normalized.key, normalized);
      });

      dispatchDevices({ type: hasLoadedRef.current ? "merge" : "seed", payload: seeded });
      setLastRefresh(Date.now());
      hasLoadedRef.current = true;
      if (hasMissingRequiredFields) {
        setErrorBanner("Some devices are missing required identity fields from API data.");
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to load devices", error);
      setErrorBanner("Unable to load device inventory.");
      if (!hasLoadedRef.current) {
        dispatchDevices({ type: "seed", payload: new Map() });
      }
    } finally {
      isRefreshingRef.current = false;
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDevices(controller.signal);

    const interval = window.setInterval(() => loadDevices(controller.signal), REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [loadDevices]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!tableWrapRef.current) return;
    const handleResize = () => {
      if (tableWrapRef.current) setViewportHeight(tableWrapRef.current.clientHeight || 520);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const nextFilters = {
      farmId: parseList(searchParams.get("farm")),
      unitType: parseList(searchParams.get("unitType")),
      unitId: parseList(searchParams.get("unitId")),
      layerId: parseList(searchParams.get("layerId")),
      kind: parseList(searchParams.get("kind")),
      status: parseList(searchParams.get("health")),
    };
    const nextSearch = searchParams.get("q") ?? "";
    const nextView = searchParams.get("view") ?? "flat";
    setFilters((prev) => (JSON.stringify(prev) === JSON.stringify(nextFilters) ? prev : nextFilters));
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setViewMode((prev) => (prev === nextView ? prev : nextView));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (filters.farmId.length) params.set("farm", filters.farmId.join(","));
    if (filters.unitType.length) params.set("unitType", filters.unitType.join(","));
    if (filters.unitId.length) params.set("unitId", filters.unitId.join(","));
    if (filters.layerId.length) params.set("layerId", filters.layerId.join(","));
    if (filters.kind.length) params.set("kind", filters.kind.join(","));
    if (filters.status.length) params.set("health", filters.status.join(","));
    if (viewMode !== "flat") params.set("view", viewMode);
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, search, viewMode, searchParams, setSearchParams]);

  const onMessage = useCallback(
    (topic, message) => {
      setWsBanner("");
      const envelope = message && typeof message === "object" ? message : {};
      let payload = envelope.payload ?? message;
      let payloadError = false;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          payloadError = true;
          payload = { raw: payload };
        }
      }
      if (!payload || typeof payload !== "object") return;

      const identity = resolveIdentity(payload, envelope);
      if (!isIdentityComplete(identity)) {
        console.warn("Ignoring live message missing required identity fields", { topic, identity, envelope });
        return;
      }

      const key = buildDeviceKey(identity);
      if (!key) {
        console.warn("Ignoring live message missing required identity fields", { topic, identity, envelope });
        return;
      }

      const timestampMs = getTimestampMs(payload.timestamp ?? envelope.timestamp) || Date.now();
      const messageKind = resolveMessageKind(topic, payload.kind ?? envelope.kind);
      const deviceKind = normalizeDeviceKind(payload.deviceKind ?? payload.device_kind ?? payload.kind ?? envelope.deviceKind);
      const existing = devicesMap.get(key);
      const msgTimes = [...(existing?.msgTimes || []), timestampMs]
        .filter((value) => timestampMs - value <= 60_000)
        .slice(-400);
      const msgRate = Number.isFinite(payload.msgRate) ? payload.msgRate : msgTimes.length;
      const metrics = extractMetricsFromPayload(payload);

      queueUpdate(key, {
        farmId: identity.farmId,
        unitType: identity.unitType,
        unitId: identity.unitId,
        layerId: normalizeLayerId(identity.layerId),
        deviceId: identity.deviceId,
        deviceKind: deviceKind || existing?.deviceKind || "UNKNOWN",
        key,
        lastSeenMs: timestampMs,
        msgTimes,
        msgRate,
        lastMessageKind: messageKind,
        payloadError: payloadError || existing?.payloadError,
        latestMetrics: Object.keys(metrics).length ? metrics : existing?.latestMetrics,
      });

      const shouldBuffer = !(viewerPaused && selectedDeviceKey === key);
      if (shouldBuffer) {
        setMessageBuffers((prev) => {
          const current = Array.isArray(prev[key]) ? prev[key] : [];
          const metricsCount = Object.keys(metrics || {}).length;
          const summary =
            messageKind === "telemetry"
              ? metricsCount
                ? `Telemetry update (${metricsCount} metrics)`
                : "Telemetry update"
              : messageKind === "status"
                ? payload.status ?? payload.state ?? "Status update"
                : payload.eventType ?? payload.type ?? "Event";
          const nextEntry = {
            id: `${timestampMs}-${current.length}-${Math.random().toString(36).slice(2)}`,
            kind: messageKind,
            timestamp: timestampMs,
            receivedAt: Date.now(),
            summary,
            location: formatLocation({
              farmId: identity.farmId,
              unitType: identity.unitType,
              unitId: identity.unitId,
              layerId: identity.layerId,
            }),
            raw: {
              ...identity,
              messageKind,
              deviceKind,
              timestamp: payload.timestamp ?? envelope.timestamp ?? new Date(timestampMs).toISOString(),
              payload,
            },
          };
          return {
            ...prev,
            [key]: [nextEntry, ...current].slice(0, STREAM_BUFFER_LIMIT),
          };
        });
      }
    },
    [devicesMap, queueUpdate, selectedDeviceKey, viewerPaused],
  );

  useStomp(WS_TOPICS, onMessage, {
    onDisconnect: () => setWsBanner("Live stream disconnected. Attempting to reconnect..."),
  });

  const devices = useMemo(() => Array.from(devicesMap.values()), [devicesMap]);

  const farmOptions = useMemo(
    () => Array.from(new Set(devices.map((entry) => entry.farmId).filter(Boolean))).sort(),
    [devices],
  );
  const unitTypeOptions = useMemo(
    () => Array.from(new Set(devices.map((entry) => entry.unitType).filter(Boolean))).sort(),
    [devices],
  );
  const unitIdOptions = useMemo(
    () => Array.from(new Set(devices.map((entry) => entry.unitId).filter(Boolean))).sort(),
    [devices],
  );
  const layerIdOptions = useMemo(
    () => Array.from(new Set(devices.map((entry) => normalizeLayerId(entry.layerId)))).sort(),
    [devices],
  );

  const derivedDevices = useMemo(() => {
    return devices.map((entry) => {
      const expected = resolveExpectedConfig(entry.deviceKind);
      const health = evaluateDeviceHealth({
        nowMs,
        lastSeenMs: entry.lastSeenMs,
        msgRate: entry.msgRate,
        expectedIntervalSec: expected.expectedIntervalSec,
        expectedMetrics: expected.expectedMetrics,
        metrics: entry.latestMetrics,
        payloadError: entry.payloadError,
      });
      const expectedRate = computeExpectedRatePerMinute(expected.expectedIntervalSec);
      const dataQuality = computeDataQuality(entry.latestMetrics, expected.expectedMetrics);
      const locationLabel = formatLocation(entry);
      return {
        ...entry,
        health,
        expectedRate,
        dataQuality,
        locationLabel,
        lastSeenAbsolute: formatAbsoluteTime(entry.lastSeenMs),
        lastSeenRelative: formatRelativeTime(entry.lastSeenMs, nowMs),
        metricsList: [...expected.expectedMetrics.critical, ...expected.expectedMetrics.optional].map((key) => ({
          key,
          value: entry.latestMetrics?.[key] ?? null,
        })),
      };
    });
  }, [devices, nowMs]);

  const resolveSortValue = (entry, key) => {
    switch (key) {
      case "health":
        return HEALTH_STATUS_ORDER.indexOf(entry.health.status);
      case "device":
        return entry.deviceId;
      case "location":
        return entry.locationLabel;
      case "lastSeen":
        return entry.lastSeenMs ?? null;
      case "msgRate":
        return entry.msgRate ?? null;
      case "dataQuality":
        return entry.dataQuality?.percent ?? null;
      default:
        return null;
    }
  };

  const compareDefaultOrder = (a, b) => {
    const statusOrder = HEALTH_STATUS_ORDER;
    const diff = statusOrder.indexOf(a.health.status) - statusOrder.indexOf(b.health.status);
    if (diff !== 0) return diff;
    if (a.lastSeenMs && b.lastSeenMs) return b.lastSeenMs - a.lastSeenMs;
    if (a.lastSeenMs) return -1;
    if (b.lastSeenMs) return 1;
    return String(a.deviceId).localeCompare(String(b.deviceId));
  };

  const compareValues = (valueA, valueB) => {
    if (valueA === valueB) return 0;
    if (valueA === null || valueA === undefined) return 1;
    if (valueB === null || valueB === undefined) return -1;
    if (typeof valueA === "number" && typeof valueB === "number") {
      return valueA - valueB;
    }
    return String(valueA).localeCompare(String(valueB));
  };

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return derivedDevices
      .filter((entry) => {
        if (filters.farmId.length && !filters.farmId.includes(entry.farmId)) return false;
        if (filters.unitType.length && !filters.unitType.includes(entry.unitType)) return false;
        if (filters.unitId.length && !filters.unitId.includes(entry.unitId)) return false;
        if (filters.layerId.length && !filters.layerId.includes(normalizeLayerId(entry.layerId))) return false;
        if (filters.kind.length && !filters.kind.includes(entry.deviceKind)) return false;
        if (filters.status.length && !filters.status.includes(entry.health.status)) return false;
        if (!query) return true;
        const haystack = `${entry.deviceId} ${entry.locationLabel}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const valueA = resolveSortValue(a, sortConfig.key);
        const valueB = resolveSortValue(b, sortConfig.key);
        const direction = sortConfig.dir === "asc" ? 1 : -1;
        const primary = compareValues(valueA, valueB);
        if (primary !== 0) return primary * direction;
        return compareDefaultOrder(a, b);
      });
  }, [derivedDevices, filters, search, sortConfig]);

  const groupedDevices = useMemo(() => {
    if (viewMode === "flat") {
      return [
        {
          id: "all",
          label: "All devices",
          devices: filteredDevices,
          counts: buildHealthCounts(filteredDevices),
        },
      ];
    }

    const groups = new Map();
    filteredDevices.forEach((device) => {
      let key = device.farmId;
      if (viewMode === "unit") {
        key = `${String(device.unitType || "").toUpperCase()} ${device.unitId || "—"}`;
      }
      if (viewMode === "kind") {
        key = device.deviceKind || "Unknown";
      }
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(device);
    });

    return Array.from(groups.entries()).map(([key, list]) => ({
      id: key,
      label: key,
      devices: list,
      counts: buildHealthCounts(list),
    }));
  }, [filteredDevices, viewMode]);

  const selectedDevice = selectedDeviceKey ? derivedDevices.find((entry) => entry.key === selectedDeviceKey) : null;
  const selectedMessages = selectedDeviceKey ? messageBuffers[selectedDeviceKey] || [] : [];

  const statusCounts = useMemo(() => buildHealthCounts(derivedDevices), [derivedDevices]);
  const lastRefreshLabel = lastRefresh ? formatRelativeTime(lastRefresh, nowMs) : "Never";

  const isDebugAllowed = useMemo(() => {
    const roleList = [role, ...(roles || [])].filter(Boolean).map((entry) => String(entry).toUpperCase());
    return roleList.some((entry) => ["ADMIN", "DEV", "ADMIN_STANDARD", "ADMIN_MONITORING_ONLY"].includes(entry));
  }, [role, roles]);

  const isVirtualized = viewMode === "flat" && filteredDevices.length > 100;
  const totalHeight = filteredDevices.length * ROW_HEIGHT;
  const startIndex = isVirtualized ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5) : 0;
  const visibleCount = isVirtualized ? Math.ceil(viewportHeight / ROW_HEIGHT) + 10 : filteredDevices.length;
  const endIndex = isVirtualized ? Math.min(filteredDevices.length, startIndex + visibleCount) : filteredDevices.length;
  const topSpacer = isVirtualized ? startIndex * ROW_HEIGHT : 0;
  const bottomSpacer = isVirtualized ? Math.max(0, totalHeight - endIndex * ROW_HEIGHT) : 0;

  const sortColumns = [
    { key: "health", label: "Health", defaultDir: "asc" },
    { key: "device", label: "Device", defaultDir: "asc" },
    { key: "location", label: "Location", defaultDir: "asc" },
    { key: "lastSeen", label: "Last seen", defaultDir: "desc" },
    { key: "msgRate", label: "Msg rate", defaultDir: "desc" },
    { key: "dataQuality", label: "Data quality", defaultDir: "desc" },
  ];

  const handleSortChange = (key) => {
    const column = sortColumns.find((item) => item.key === key);
    if (!column) return;
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: column.defaultDir };
    });
  };

  return (
    <div className={styles.page}>
      <Header title="Device Monitor" />

      {errorBanner ? <div className={styles.bannerError}>{errorBanner}</div> : null}
      {wsBanner ? <div className={styles.bannerWarn}>{wsBanner}</div> : null}

      <section className={styles.summaryBar}>
        <div className={styles.summaryCards}>
          {[
            { key: "total", label: "Total devices", value: statusCounts.total },
            { key: "ok", label: "OK", value: statusCounts.ok, filter: "ok" },
            { key: "degraded", label: "Degraded", value: statusCounts.degraded, filter: "degraded" },
            { key: "critical", label: "Critical", value: statusCounts.critical, filter: "critical" },
            { key: "offline", label: "Offline", value: statusCounts.offline, filter: "offline" },
          ].map((card) => (
            <button
              key={card.key}
              type="button"
              className={`${styles.summaryCard} ${card.filter ? styles[`summary${card.filter}`] : ""}`}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  status: card.filter ? [card.filter] : [],
                }))
              }
            >
              <p className={styles.summaryLabel}>{card.label}</p>
              <p className={styles.summaryValue}>{card.value}</p>
            </button>
          ))}
        </div>
        <div className={styles.refreshBlock}>
          <p>Last refresh: {lastRefreshLabel}</p>
          <button type="button" className={styles.secondaryButton} onClick={() => loadDevices()}>
            Refresh
          </button>
        </div>
      </section>

      <section className={styles.cardSticky}>
        <DeviceFilters
          search={search}
          onSearch={setSearch}
          filterState={filters}
          onFilterChange={(field, value) => setFilters((prev) => ({ ...prev, [field]: value }))}
          farmOptions={farmOptions}
          unitTypeOptions={unitTypeOptions}
          unitIdOptions={unitIdOptions}
          layerIdOptions={layerIdOptions}
          kindOptions={DEVICE_KIND_OPTIONS}
          healthOptions={HEALTH_STATUS_ORDER}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </section>

      <section className={styles.card}>
        <div
          className={styles.tableWrap}
          ref={tableWrapRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                {sortColumns.map((column) => (
                  <th key={column.key}>
                    <button
                      type="button"
                      className={`${styles.sortButton} ${sortConfig.key === column.key ? styles.sortActive : ""}`}
                      onClick={() => handleSortChange(column.key)}
                    >
                      <span>{column.label}</span>
                      <span
                        className={`${styles.sortArrow} ${
                          sortConfig.key === column.key ? styles.sortArrowActive : ""
                        } ${
                          sortConfig.key === column.key && sortConfig.dir === "desc" ? styles.sortArrowDesc : ""
                        }`}
                      />
                    </button>
                  </th>
                ))}
                <th>Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            {loading ? (
              <tbody>
                <tr>
                  <td colSpan={8}>Loading devices...</td>
                </tr>
              </tbody>
            ) : null}
            {!loading && filteredDevices.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={8}>No devices found.</td>
                </tr>
              </tbody>
            ) : null}
            {!loading && filteredDevices.length > 0 && viewMode === "flat" ? (
              <tbody>
                {topSpacer ? (
                  <tr className={styles.spacerRow} aria-hidden="true">
                    <td colSpan={8} style={{ height: `${topSpacer}px` }} />
                  </tr>
                ) : null}
                {filteredDevices.slice(startIndex, endIndex).map((entry) => (
                  <tr key={entry.key}>
                    <td>
                      <DeviceStatusBadge status={entry.health.status} />
                    </td>
                    <td>
                      <p className={styles.deviceId}>{entry.deviceId}</p>
                      <p className={styles.deviceSubtext}>{entry.deviceKind}</p>
                    </td>
                    <td>
                      <p className={styles.locationLine}>{entry.locationLabel}</p>
                    </td>
                    <td title={entry.lastSeenAbsolute}>{entry.lastSeenRelative}</td>
                    <td>
                      <span
                        className={`${styles.rateChip} ${
                          entry.expectedRate && entry.msgRate < entry.expectedRate * 0.7
                            ? styles.rateLow
                            : entry.expectedRate && entry.msgRate < entry.expectedRate
                              ? styles.rateWarn
                              : styles.rateOk
                        }`}
                      >
                        {entry.msgRate}/min
                      </span>
                    </td>
                    <td>
                      <p className={styles.qualityPercent}>{entry.dataQuality.percent}%</p>
                      {entry.dataQuality.missingCritical.length > 0 || entry.dataQuality.missingOptional.length > 0 ? (
                        <p className={styles.qualityMissing}>
                          Missing: {[...entry.dataQuality.missingCritical, ...entry.dataQuality.missingOptional]
                            .slice(0, 3)
                            .join(", ")}
                        </p>
                      ) : (
                        <p className={styles.qualityMissing}>All expected metrics</p>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => setSelectedDeviceKey(entry.key)}
                      >
                        Details
                      </button>
                    </td>
                    <td>
                      {isDebugAllowed ? (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => {
                            setSelectedDeviceKey(entry.key);
                            setDebugOpen(true);
                          }}
                        >
                          Debug
                        </button>
                      ) : (
                        <span className={styles.mutedText}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {bottomSpacer ? (
                  <tr className={styles.spacerRow} aria-hidden="true">
                    <td colSpan={8} style={{ height: `${bottomSpacer}px` }} />
                  </tr>
                ) : null}
              </tbody>
            ) : null}
            {!loading && filteredDevices.length > 0 && viewMode !== "flat" ? (
              <tbody>
                {groupedDevices.map((group) => (
                  <React.Fragment key={group.id}>
                    <tr className={styles.groupRow}>
                      <td colSpan={8}>
                        <div className={styles.groupHeader}>
                          <h4>{group.label}</h4>
                          <div className={styles.groupCounts}>
                            <span>OK {group.counts.ok}</span>
                            <span>Degraded {group.counts.degraded}</span>
                            <span>Critical {group.counts.critical}</span>
                            <span>Offline {group.counts.offline}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {group.devices.map((entry) => (
                      <tr key={entry.key}>
                        <td>
                          <DeviceStatusBadge status={entry.health.status} />
                        </td>
                        <td>
                          <p className={styles.deviceId}>{entry.deviceId}</p>
                          <p className={styles.deviceSubtext}>{entry.deviceKind}</p>
                        </td>
                        <td>
                          <p className={styles.locationLine}>{entry.locationLabel}</p>
                        </td>
                        <td title={entry.lastSeenAbsolute}>{entry.lastSeenRelative}</td>
                        <td>
                          <span
                            className={`${styles.rateChip} ${
                              entry.expectedRate && entry.msgRate < entry.expectedRate * 0.7
                                ? styles.rateLow
                                : entry.expectedRate && entry.msgRate < entry.expectedRate
                                  ? styles.rateWarn
                                  : styles.rateOk
                            }`}
                          >
                            {entry.msgRate}/min
                          </span>
                        </td>
                        <td>
                          <p className={styles.qualityPercent}>{entry.dataQuality.percent}%</p>
                          {entry.dataQuality.missingCritical.length > 0 || entry.dataQuality.missingOptional.length > 0 ? (
                            <p className={styles.qualityMissing}>
                              Missing: {[...entry.dataQuality.missingCritical, ...entry.dataQuality.missingOptional]
                                .slice(0, 3)
                                .join(", ")}
                            </p>
                          ) : (
                            <p className={styles.qualityMissing}>All expected metrics</p>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => setSelectedDeviceKey(entry.key)}
                          >
                            Details
                          </button>
                        </td>
                        <td>
                          {isDebugAllowed ? (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => {
                                setSelectedDeviceKey(entry.key);
                                setDebugOpen(true);
                              }}
                            >
                              Debug
                            </button>
                          ) : (
                            <span className={styles.mutedText}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            ) : null}
          </table>
        </div>
      </section>

      <DeviceDetailsDrawer
        device={selectedDevice}
        health={selectedDevice?.health ?? { status: "offline" }}
        expectedRate={selectedDevice?.expectedRate}
        dataQuality={selectedDevice?.dataQuality ?? { expected: 0, received: 0, percent: 100, missingCritical: [], missingOptional: [] }}
        isOpen={Boolean(selectedDevice)}
        onClose={() => {
          setSelectedDeviceKey("");
          setDebugOpen(false);
        }}
        onDebug={() => setDebugOpen(true)}
        allowDebug={isDebugAllowed}
        messages={selectedMessages}
        metrics={selectedDevice?.metricsList ?? []}
      />

      <JsonStreamViewer
        device={selectedDevice}
        isOpen={debugOpen && Boolean(selectedDevice)}
        messages={selectedMessages}
        paused={viewerPaused}
        onPauseToggle={() => setViewerPaused((prev) => !prev)}
        onClear={() => selectedDeviceKey && setMessageBuffers((prev) => ({ ...prev, [selectedDeviceKey]: [] }))}
        onClose={() => setDebugOpen(false)}
      />
    </div>
  );
}
