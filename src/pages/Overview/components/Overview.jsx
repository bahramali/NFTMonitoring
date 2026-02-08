import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../../common/Header";
import { listDevices } from "../../../api/deviceMonitoring.js";
import { useStomp } from "../../../hooks/useStomp.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  buildDeviceKey,
  isIdentityComplete,
  normalizeIdValue,
  normalizeUnitType,
  resolveIdentity,
} from "../../../utils/deviceIdentity.js";
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
  buildHealthReasons,
  computeMetricTrend,
  getWorstHealthStatus,
  KEY_METRICS_BY_KIND,
  normalizeDeviceKind,
  resolveExpectedConfig,
} from "../utils/deviceHealth.js";
import styles from "./Overview.module.css";

const REFRESH_INTERVAL_MS = 5000;
const FAST_REFRESH_INTERVAL_MS = 8000;
const SLOW_RECONCILE_INTERVAL_MS = 120000;
const STREAM_BUFFER_LIMIT = 20;
const METRIC_HISTORY_LIMIT = 200;
const TIME_WINDOW_OPTIONS = [
  { label: "15m", value: 15 * 60 * 1000 },
  { label: "1h", value: 60 * 60 * 1000 },
  { label: "6h", value: 6 * 60 * 60 * 1000 },
  { label: "24h", value: 24 * 60 * 60 * 1000 },
];
const ROW_HEIGHT = 64;
const ALL_OPTION = "ALL";
const HEALTH_FILTER_ORDER = ["ok", "degraded", "critical", "offline"];

const DEFAULT_FILTERS = {
  farmId: [ALL_OPTION],
  unitType: [ALL_OPTION],
  unitId: [ALL_OPTION],
  layerId: [ALL_OPTION],
  kind: [ALL_OPTION],
  status: [ALL_OPTION],
  messageKind: [ALL_OPTION],
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

const normalizeMessageKind = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return MESSAGE_KIND_OPTIONS.includes(normalized) ? normalized : "telemetry";
};

const normalizeHealthStatus = (value) => {
  if (!value) return "offline";
  const normalized = String(value).trim().toLowerCase();
  return HEALTH_STATUS_ORDER.includes(normalized) ? normalized : normalized;
};

const normalizeFilterSelection = (values, normalizer) => {
  const normalizedValues = Array.from(
    new Set(
      values
        .map((value) => (value === ALL_OPTION || !normalizer ? value : normalizer(value)))
        .filter(Boolean),
    ),
  );
  if (normalizedValues.length === 0) return [ALL_OPTION];
  if (normalizedValues.includes(ALL_OPTION) && normalizedValues.length > 1) {
    return normalizedValues.filter((value) => value !== ALL_OPTION);
  }
  return normalizedValues;
};

const isAllSelected = (values) => !values || values.length === 0 || values.includes(ALL_OPTION);

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
    deviceType:
      device?.deviceType ??
      device?.device_type ??
      device?.deviceKind ??
      device?.device_kind ??
      device?.kind ??
      device?.type ??
      "",
    deviceKind: normalizeDeviceKind(
      device?.deviceType ??
        device?.device_type ??
        device?.deviceKind ??
        device?.device_kind ??
        device?.kind ??
        device?.type,
    ),
    lastSeenMs: getTimestampMs(device?.lastSeen ?? device?.timestamp ?? device?.updatedAt),
    lastTelemetryMs: getTimestampMs(
      device?.lastTelemetryTimestamp ?? device?.lastTelemetry ?? device?.last_telemetry ?? device?.lastTelemetryMs,
    ),
    lastTelemetryHealth: device?.lastTelemetryHealth ?? device?.telemetryHealth ?? null,
    msgTimes: [],
    msgRate: Number.isFinite(device?.msgRate) ? device.msgRate : 0,
    lastMessageKind: normalizeMessageKind(
      device?.lastSeenKind ??
        device?.lastMessageKind ??
        device?.last_message_kind ??
        device?.messageKind ??
        device?.message_kind,
    ),
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

const HEALTH_PRIORITY = ["offline", "critical", "degraded", "ok"];
const DEVICE_KIND_PRIORITY = ["TANK", "LAYER", "ENV", "GERMINATION", "UNKNOWN"];

const getHealthRank = (status) => {
  const index = HEALTH_PRIORITY.indexOf(status);
  return index === -1 ? HEALTH_PRIORITY.length : index;
};

const getOldestSeenMs = (devices) => {
  const timestamps = devices
    .map((device) => device.lastSeenMs)
    .filter((timestamp) => Number.isFinite(timestamp));
  if (timestamps.length === 0) return null;
  return Math.min(...timestamps);
};

const compareTreeNodes = (a, b) => {
  const healthDiff = getHealthRank(a.worst) - getHealthRank(b.worst);
  if (healthDiff !== 0) return healthDiff;
  const oldestA = a.oldestSeenMs ?? Number.POSITIVE_INFINITY;
  const oldestB = b.oldestSeenMs ?? Number.POSITIVE_INFINITY;
  if (oldestA !== oldestB) return oldestA - oldestB;
  if (a.level === "kind" && b.level === "kind") {
    const kindA = DEVICE_KIND_PRIORITY.indexOf(String(a.label).toUpperCase());
    const kindB = DEVICE_KIND_PRIORITY.indexOf(String(b.label).toUpperCase());
    const kindDiff = (kindA === -1 ? DEVICE_KIND_PRIORITY.length : kindA) -
      (kindB === -1 ? DEVICE_KIND_PRIORITY.length : kindB);
    if (kindDiff !== 0) return kindDiff;
  }
  return String(a.label).localeCompare(String(b.label));
};

const sortDevicesForTree = (devices) =>
  [...devices].sort((a, b) => {
    const statusDiff = getHealthRank(a.health.status) - getHealthRank(b.health.status);
    if (statusDiff !== 0) return statusDiff;
    const lastSeenA = a.lastSeenMs ?? Number.POSITIVE_INFINITY;
    const lastSeenB = b.lastSeenMs ?? Number.POSITIVE_INFINITY;
    if (lastSeenA !== lastSeenB) return lastSeenA - lastSeenB;
    return String(a.deviceId).localeCompare(String(b.deviceId));
  });

const buildHierarchyTree = (devices) => {
  const root = {
    id: "root",
    label: "All",
    level: "root",
    children: new Map(),
    devices: [],
  };
  const seenDeviceKeys = new Set();

  devices.forEach((device) => {
    const deviceKey = device.key || buildDeviceKey(device);
    if (deviceKey) {
      if (seenDeviceKeys.has(deviceKey)) {
        console.error("Duplicate device key detected while building hierarchy tree", { key: deviceKey });
        return;
      }
      seenDeviceKeys.add(deviceKey);
    }
    const farmId = normalizeIdValue(device.farmId);
    const unitTypeRaw = normalizeUnitType(device.unitType);
    const unitId = normalizeIdValue(device.unitId);
    const layerId = normalizeLayerId(device.layerId);
    const deviceKind = normalizeDeviceKind(device.deviceKind || device.deviceType);

    const farm = farmId || "—";
    const unitType = unitTypeRaw ? unitTypeRaw.toUpperCase() : "—";
    const unitLabel = unitId || "—";
    const kindLabel = String(deviceKind || "UNKNOWN").toUpperCase();

    const farmKey = farmId || "unknown";
    const unitTypeKey = `${farmKey}|${unitTypeRaw || "unknown"}`;
    const unitIdKey = `${unitTypeKey}|${unitId || "unknown"}`;
    const layerKey = `${unitIdKey}|${layerId}`;
    const kindKey = `${layerKey}|${deviceKind || "UNKNOWN"}`;

    const chain = [
      { level: "farm", label: farm, key: farmKey },
      { level: "unitType", label: unitType, key: unitTypeKey },
      { level: "unitId", label: unitLabel, key: unitIdKey },
      { level: "layerId", label: layerId, key: layerKey },
      { level: "kind", label: kindLabel, key: kindKey },
    ];

    let cursor = root;
    chain.forEach((entry) => {
      if (!cursor.children.has(entry.key)) {
        cursor.children.set(entry.key, {
          id: entry.key,
          label: entry.label,
          level: entry.level,
          children: new Map(),
          devices: [],
        });
      }
      cursor = cursor.children.get(entry.key);
    });

    cursor.devices.push(device);
  });

  const toNodeList = (node, depth = 0) => {
    const children = Array.from(node.children.values()).map((child) => toNodeList(child, depth + 1));
    const sortedChildren = children.sort(compareTreeNodes);
    let worst = "ok";
    let oldestSeenMs = null;
    let devicesForNode = node.devices;

    if (sortedChildren.length > 0) {
      worst = getWorstHealthStatus(sortedChildren.map((child) => child.worst));
      oldestSeenMs = Math.min(
        ...sortedChildren
          .map((child) => child.oldestSeenMs)
          .filter((timestamp) => Number.isFinite(timestamp)),
      );
      if (!Number.isFinite(oldestSeenMs)) oldestSeenMs = null;
    } else {
      devicesForNode = sortDevicesForTree(node.devices);
      worst = getWorstHealthStatus(devicesForNode.map((device) => device.health.status));
      oldestSeenMs = getOldestSeenMs(devicesForNode);
    }
    return {
      ...node,
      depth,
      children: sortedChildren,
      devices: devicesForNode,
      worst,
      oldestSeenMs,
    };
  };

  return toNodeList(root, 0);
};

const aggregateTreeCounts = (node) => {
  if (!node) return { counts: buildHealthCounts([]), worst: "ok" };
  if (node.children.length === 0) {
    const counts = buildHealthCounts(node.devices || []);
    const statuses = (node.devices || []).map((device) => device.health.status);
    return { counts, worst: getWorstHealthStatus(statuses) };
  }
  const counts = { total: 0, ok: 0, degraded: 0, critical: 0, offline: 0 };
  const statuses = [];
  node.children.forEach((child) => {
    const result = aggregateTreeCounts(child);
    HEALTH_PRIORITY.forEach((status) => {
      counts[status] += result.counts[status];
    });
    counts.total += result.counts.total;
    statuses.push(result.worst);
  });
  return { counts, worst: getWorstHealthStatus(statuses) };
};

const flattenTree = (node) => {
  const list = [];
  node.children.forEach((child) => {
    list.push(child);
    list.push(...flattenTree(child));
  });
  return list;
};

function VirtualizedDeviceTable({ devices, sortColumns, isDebugAllowed, onSelect, onDebug }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);
  const tableScrollRef = useRef(null);
  const isVirtualized = devices.length > 100;
  const totalHeight = devices.length * ROW_HEIGHT;
  const startIndex = isVirtualized ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5) : 0;
  const visibleCount = isVirtualized ? Math.ceil(viewportHeight / ROW_HEIGHT) + 10 : devices.length;
  const endIndex = isVirtualized ? Math.min(devices.length, startIndex + visibleCount) : devices.length;
  const topSpacer = isVirtualized ? startIndex * ROW_HEIGHT : 0;
  const bottomSpacer = isVirtualized ? Math.max(0, totalHeight - endIndex * ROW_HEIGHT) : 0;

  useEffect(() => {
    if (!tableScrollRef.current) return;
    const handleResize = () => {
      if (tableScrollRef.current) setViewportHeight(tableScrollRef.current.clientHeight || 520);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const visibleDevices = devices.slice(startIndex, endIndex);

  return (
    <div
      className={`${styles.treeLeafScroller} ${isVirtualized ? styles.treeLeafScrollerVirtual : ""}`}
      ref={tableScrollRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <table className={`${styles.table} ${styles.treeDeviceTable}`}>
        <thead>
          <tr>
            {sortColumns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th>Details</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {topSpacer ? (
            <tr className={styles.spacerRow} aria-hidden="true">
              <td colSpan={8} style={{ height: `${topSpacer}px` }} />
            </tr>
          ) : null}
          {visibleDevices.map((entry) => (
            <tr key={entry.key} className={styles.treeDeviceRow}>
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
                <button type="button" className={styles.primaryButton} onClick={() => onSelect(entry.key)}>
                  Details
                </button>
              </td>
              <td>
                {isDebugAllowed ? (
                  <button type="button" className={styles.secondaryButton} onClick={() => onDebug(entry.key)}>
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
      </table>
    </div>
  );
}

export default function Overview() {
  const { role, roles } = useAuth();
  const [devicesMap, dispatchDevices] = useReducer(devicesReducer, new Map());
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState(() => ({
    farmId: normalizeFilterSelection(parseList(searchParams.get("farm"))),
    unitType: normalizeFilterSelection(parseList(searchParams.get("unitType"))),
    unitId: normalizeFilterSelection(parseList(searchParams.get("unitId"))),
    layerId: normalizeFilterSelection(parseList(searchParams.get("layerId")).map(normalizeLayerId)),
    kind: normalizeFilterSelection(parseList(searchParams.get("kind")).map(normalizeDeviceKind)),
    status: normalizeFilterSelection(parseList(searchParams.get("health")).map(normalizeHealthStatus)),
    messageKind: normalizeFilterSelection(parseList(searchParams.get("messageKind")).map(normalizeMessageKind)),
  }));
  const [viewMode, setViewMode] = useState(() => searchParams.get("view") ?? "flat");
  const [sortConfig, setSortConfig] = useState({ key: "health", dir: "asc" });
  const [selectedDeviceKey, setSelectedDeviceKey] = useState("");
  const [viewerPaused, setViewerPaused] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [wsBanner, setWsBanner] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [messageBuffers, setMessageBuffers] = useState({});
  const [metricBuffers, setMetricBuffers] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);
  const [treeExpanded, setTreeExpanded] = useState(() => {
    try {
      const stored = window.localStorage.getItem("deviceMonitorTreeExpanded");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  });
  const [timeWindowMs, setTimeWindowMs] = useState(TIME_WINDOW_OPTIONS[0].value);

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
        if (seeded.has(normalized.key)) {
          console.error("Duplicate device key detected in inventory payload", {
            key: normalized.key,
            device: normalized,
          });
          return;
        }
        seeded.set(normalized.key, normalized);
      });

      dispatchDevices({ type: hasLoadedRef.current ? "merge" : "seed", payload: seeded });
      setMetricBuffers((prev) => {
        const next = { ...prev };
        seeded.forEach((device, key) => {
          if (!device.latestMetrics || Object.keys(device.latestMetrics).length === 0) return;
          const timestamp = device.lastSeenMs ?? Date.now();
          const current = Array.isArray(next[key]) ? next[key] : [];
          next[key] = [{ timestamp, metrics: device.latestMetrics }, ...current].slice(0, METRIC_HISTORY_LIMIT);
        });
        return next;
      });
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

    return () => {
      controller.abort();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [loadDevices]);

  useEffect(() => {
    const controller = new AbortController();
    const intervalMs = wsConnected ? SLOW_RECONCILE_INTERVAL_MS : FAST_REFRESH_INTERVAL_MS;
    if (!wsConnected) {
      loadDevices(controller.signal);
    }
    const interval = window.setInterval(() => loadDevices(controller.signal), intervalMs);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadDevices, wsConnected]);

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
      farmId: normalizeFilterSelection(parseList(searchParams.get("farm"))),
      unitType: normalizeFilterSelection(parseList(searchParams.get("unitType"))),
      unitId: normalizeFilterSelection(parseList(searchParams.get("unitId"))),
      layerId: normalizeFilterSelection(parseList(searchParams.get("layerId")).map(normalizeLayerId)),
      kind: normalizeFilterSelection(parseList(searchParams.get("kind")).map(normalizeDeviceKind)),
      status: normalizeFilterSelection(parseList(searchParams.get("health")).map(normalizeHealthStatus)),
      messageKind: normalizeFilterSelection(parseList(searchParams.get("messageKind")).map(normalizeMessageKind)),
    };
    const nextSearch = searchParams.get("q") ?? "";
    const nextView = searchParams.get("view") ?? "flat";
    const nextWindow = Number(searchParams.get("window")) || TIME_WINDOW_OPTIONS[0].value;
    setFilters((prev) => (JSON.stringify(prev) === JSON.stringify(nextFilters) ? prev : nextFilters));
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setViewMode((prev) => (prev === nextView ? prev : nextView));
    setTimeWindowMs((prev) => (prev === nextWindow ? prev : nextWindow));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (!isAllSelected(filters.farmId)) params.set("farm", filters.farmId.join(","));
    if (!isAllSelected(filters.unitType)) params.set("unitType", filters.unitType.join(","));
    if (!isAllSelected(filters.unitId)) params.set("unitId", filters.unitId.join(","));
    if (!isAllSelected(filters.layerId)) params.set("layerId", filters.layerId.join(","));
    if (!isAllSelected(filters.kind)) params.set("kind", filters.kind.join(","));
    if (!isAllSelected(filters.status)) params.set("health", filters.status.join(","));
    if (!isAllSelected(filters.messageKind)) params.set("messageKind", filters.messageKind.join(","));
    if (viewMode !== "flat") params.set("view", viewMode);
    if (timeWindowMs !== TIME_WINDOW_OPTIONS[0].value) params.set("window", String(timeWindowMs));
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, search, viewMode, timeWindowMs, searchParams, setSearchParams]);

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
      const deviceKind = normalizeDeviceKind(
        payload.deviceType ??
          payload.device_type ??
          payload.deviceKind ??
          payload.device_kind ??
          envelope.deviceType ??
          envelope.device_type ??
          envelope.deviceKind,
      );
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
        lastTelemetryMs: messageKind === "telemetry" ? timestampMs : existing?.lastTelemetryMs,
        lastTelemetryHealth:
          messageKind === "telemetry" ? payload.health ?? existing?.lastTelemetryHealth : existing?.lastTelemetryHealth,
        msgTimes,
        msgRate,
        lastMessageKind: messageKind,
        payloadError: payloadError || existing?.payloadError,
        latestMetrics:
          messageKind === "telemetry" && Object.keys(metrics).length ? metrics : existing?.latestMetrics,
      });

      if (messageKind === "telemetry" && Object.keys(metrics || {}).length) {
        setMetricBuffers((prev) => {
          const current = Array.isArray(prev[key]) ? prev[key] : [];
          const nextEntry = { timestamp: timestampMs, metrics };
          return {
            ...prev,
            [key]: [nextEntry, ...current].slice(0, METRIC_HISTORY_LIMIT),
          };
        });
      }

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
            metricsSnapshot: metrics,
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
    onConnect: () => {
      setWsConnected(true);
      setWsBanner("");
    },
    onDisconnect: () => {
      setWsConnected(false);
      setWsBanner("Live stream disconnected. Attempting to reconnect...");
    },
    onError: () => {
      setWsConnected(false);
      setWsBanner("Live stream disconnected. Attempting to reconnect...");
    },
  });

  const devices = useMemo(() => Array.from(devicesMap.values()), [devicesMap]);

  const farmOptions = useMemo(
    () => {
      const values = Array.from(new Set(devices.map((entry) => entry.farmId).filter(Boolean))).sort();
      return [ALL_OPTION, ...values];
    },
    [devices],
  );
  const unitTypeOptions = useMemo(
    () => {
      const values = Array.from(new Set(devices.map((entry) => entry.unitType).filter(Boolean))).sort();
      return [ALL_OPTION, ...values];
    },
    [devices],
  );
  const unitIdOptions = useMemo(
    () => {
      const values = Array.from(new Set(devices.map((entry) => entry.unitId).filter(Boolean))).sort();
      return [ALL_OPTION, ...values];
    },
    [devices],
  );
  const layerIdOptions = useMemo(
    () => {
      const values = new Set(devices.map((entry) => normalizeLayerId(entry.layerId)));
      values.add("NA");
      return [ALL_OPTION, ...Array.from(values).sort()];
    },
    [devices],
  );
  const kindOptions = useMemo(() => {
    const values = new Set(devices.map((entry) => entry.deviceKind).filter(Boolean));
    DEVICE_KIND_OPTIONS.forEach((value) => values.add(value));
    return [ALL_OPTION, ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [devices]);
  const healthFilterOptions = useMemo(
    () => [{ value: ALL_OPTION, label: ALL_OPTION }, ...HEALTH_FILTER_ORDER.map((value) => ({ value, label: value.toUpperCase() }))],
    [],
  );
  const messageKindOptions = useMemo(
    () => [{ value: ALL_OPTION, label: ALL_OPTION }, ...MESSAGE_KIND_OPTIONS.map((value) => ({ value, label: value }))],
    [],
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
      const expectedIntervalMs = (expected.expectedIntervalSec ?? 0) * 1000;
      const lastTelemetryAgeMs = entry.lastTelemetryMs ? Math.max(0, nowMs - entry.lastTelemetryMs) : null;
      const telemetryStatus = !entry.lastTelemetryMs
        ? "missing"
        : expectedIntervalMs && lastTelemetryAgeMs > expectedIntervalMs * 2
          ? "stale"
          : "fresh";
      return {
        ...entry,
        health,
        expectedRate,
        expectedIntervalSec: expected.expectedIntervalSec,
        dataQuality,
        locationLabel,
        lastSeenAbsolute: formatAbsoluteTime(entry.lastSeenMs),
        lastSeenRelative: formatRelativeTime(entry.lastSeenMs, nowMs),
        lastTelemetryAbsolute: formatAbsoluteTime(entry.lastTelemetryMs),
        lastTelemetryRelative: formatRelativeTime(entry.lastTelemetryMs, nowMs),
        lastTelemetryAgeMs,
        telemetryStatus,
        metricsList: [...expected.expectedMetrics.critical, ...expected.expectedMetrics.optional].map((key) => ({
          key,
          value: entry.latestMetrics?.[key] ?? null,
        })),
      };
    });
  }, [devices, nowMs]);

  useEffect(() => {
    try {
      window.localStorage.setItem("deviceMonitorTreeExpanded", JSON.stringify(treeExpanded));
    } catch (error) {
      console.warn("Unable to persist tree expansion state", error);
    }
  }, [treeExpanded]);

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
        if (!isAllSelected(filters.farmId) && !filters.farmId.includes(entry.farmId)) return false;
        if (!isAllSelected(filters.unitType) && !filters.unitType.includes(entry.unitType)) return false;
        if (!isAllSelected(filters.unitId) && !filters.unitId.includes(entry.unitId)) return false;
        if (
          !isAllSelected(filters.layerId) &&
          !filters.layerId.includes(normalizeLayerId(entry.layerId))
        )
          return false;
        if (!isAllSelected(filters.kind) && !filters.kind.includes(entry.deviceKind)) return false;
        if (
          !isAllSelected(filters.status) &&
          !filters.status.includes(normalizeHealthStatus(entry.health.status))
        )
          return false;
        if (
          !isAllSelected(filters.messageKind) &&
          !filters.messageKind.includes(normalizeMessageKind(entry.lastMessageKind))
        )
          return false;
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

  const selectedDevice = selectedDeviceKey ? derivedDevices.find((entry) => entry.key === selectedDeviceKey) : null;
  const selectedMessages = selectedDeviceKey ? messageBuffers[selectedDeviceKey] || [] : [];
  const selectedMetricHistory = selectedDeviceKey ? metricBuffers[selectedDeviceKey] || [] : [];
  const keyMetrics = useMemo(() => {
    if (!selectedDevice) return [];
    const byKind = KEY_METRICS_BY_KIND[selectedDevice.deviceKind];
    if (byKind && byKind.length) return byKind;
    const expected = selectedDevice.metricsList?.map((metric) => metric.key).filter(Boolean) || [];
    if (expected.length) return expected;
    const latestKeys = Object.keys(selectedDevice.latestMetrics || {});
    return latestKeys.slice(0, 6);
  }, [selectedDevice]);
  const selectedHealthReasons = useMemo(() => {
    if (!selectedDevice) return [];
    return buildHealthReasons({
      health: selectedDevice.health,
      lastSeenMs: selectedDevice.lastSeenMs,
      nowMs,
      msgRate: selectedDevice.msgRate,
      expectedRate: selectedDevice.expectedRate,
      dataQuality: selectedDevice.dataQuality,
      payloadError: selectedDevice.payloadError,
    });
  }, [selectedDevice, nowMs]);
  const selectedTrendData = useMemo(() => {
    if (!selectedDevice) return [];
    return keyMetrics.map((metricKey) => {
      const currentValue = selectedDevice.latestMetrics?.[metricKey] ?? null;
      const latestSample = selectedMetricHistory.find((sample) =>
        Number.isFinite(sample.metrics?.[metricKey]),
      );
      const trend = computeMetricTrend({
        samples: selectedMetricHistory,
        metricKey,
        currentValue,
        nowMs,
        windowMs: timeWindowMs,
      });
      const sparkline = [...selectedMetricHistory]
        .reverse()
        .filter((sample) => sample.timestamp >= nowMs - timeWindowMs)
        .map((sample) => ({
          timestamp: sample.timestamp,
          value: sample.metrics?.[metricKey] ?? null,
        }))
        .filter((sample) => Number.isFinite(sample.value));
      return {
        key: metricKey,
        value: currentValue,
        trend,
        sparkline,
        lastUpdatedMs: latestSample?.timestamp ?? null,
      };
    });
  }, [keyMetrics, selectedDevice, selectedMetricHistory, nowMs, timeWindowMs]);

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

  const hierarchyTree = useMemo(() => buildHierarchyTree(filteredDevices), [filteredDevices]);
  const allTreeNodes = useMemo(() => flattenTree(hierarchyTree), [hierarchyTree]);
  const autoExpandedRef = useRef(false);

  useEffect(() => {
    if (allTreeNodes.length === 0) return;
    const nodeIds = new Set(allTreeNodes.map((node) => node.id));
    setTreeExpanded((prev) => {
      let changed = false;
      const next = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (nodeIds.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [allTreeNodes]);

  const handleToggleNode = (nodeId) => {
    setTreeExpanded((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const buildProblemExpansion = useCallback((node) => {
    const expanded = {};
    const walk = (current) => {
      current.children.forEach((child) => {
        const { counts } = aggregateTreeCounts(child);
        const hasProblems = counts.critical > 0 || counts.offline > 0;
        expanded[child.id] = hasProblems;
        if (hasProblems && child.children.length > 0) {
          walk(child);
        }
      });
    };
    walk(node);
    return expanded;
  }, []);

  const handleExpandAll = () => {
    const expanded = {};
    allTreeNodes.forEach((node) => {
      expanded[node.id] = true;
    });
    setTreeExpanded(expanded);
  };

  const handleExpandProblems = () => {
    setTreeExpanded(buildProblemExpansion(hierarchyTree));
  };

  const handleCollapseAll = () => {
    const collapsed = {};
    allTreeNodes.forEach((node) => {
      collapsed[node.id] = false;
    });
    setTreeExpanded(collapsed);
  };

  useEffect(() => {
    if (viewMode !== "hierarchical") return;
    if (autoExpandedRef.current) return;
    if (Object.keys(treeExpanded).length > 0) return;
    const expanded = buildProblemExpansion(hierarchyTree);
    if (Object.values(expanded).some(Boolean)) {
      setTreeExpanded(expanded);
      autoExpandedRef.current = true;
    }
  }, [buildProblemExpansion, hierarchyTree, treeExpanded, viewMode]);

  const renderDeviceTable = (devices) => (
    <VirtualizedDeviceTable
      devices={devices}
      sortColumns={sortColumns}
      isDebugAllowed={isDebugAllowed}
      onSelect={setSelectedDeviceKey}
      onDebug={(deviceKey) => {
        setSelectedDeviceKey(deviceKey);
        setDebugOpen(true);
      }}
    />
  );

  const renderTreeRows = (node) =>
    node.children.flatMap((child) => {
      const { counts, worst } = aggregateTreeCounts(child);
      const isExpanded = treeExpanded[child.id] ?? child.level === "farm";
      const rows = [
        <div
          key={`${child.id}-group`}
          className={styles.treeGroup}
          style={{ "--tree-depth": child.depth }}
        >
          <button type="button" className={styles.treeToggle} onClick={() => handleToggleNode(child.id)}>
            <span className={`${styles.treeChevron} ${isExpanded ? styles.treeChevronOpen : ""}`} />
            <span className={styles.treeLabel}>{child.label}</span>
            <DeviceStatusBadge status={worst} />
            <span className={styles.treeCounts}>
              OK {counts.ok} • Degraded {counts.degraded} • Critical {counts.critical} • Offline {counts.offline}
            </span>
          </button>
        </div>,
      ];

      if (isExpanded) {
        if (child.children.length > 0) {
          rows.push(...renderTreeRows(child));
        } else {
          rows.push(
            <div
              key={`${child.id}-devices`}
              className={styles.treeLeafBlock}
              style={{ "--tree-depth": child.depth + 1 }}
            >
              {renderDeviceTable(child.devices)}
            </div>,
          );
        }
      }

      return rows;
    });

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
                  status: card.filter ? [card.filter] : [ALL_OPTION],
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
          onFilterChange={(field, value) =>
            setFilters((prev) => ({
              ...prev,
              [field]: normalizeFilterSelection(
                value,
                {
                  layerId: normalizeLayerId,
                  kind: normalizeDeviceKind,
                  status: normalizeHealthStatus,
                  messageKind: normalizeMessageKind,
                }[field],
              ),
            }))
          }
          farmOptions={farmOptions}
          unitTypeOptions={unitTypeOptions}
          unitIdOptions={unitIdOptions}
          layerIdOptions={layerIdOptions}
          kindOptions={kindOptions}
          healthOptions={healthFilterOptions}
          messageKindOptions={messageKindOptions}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </section>

      <section className={styles.card}>
        <div className={styles.viewActions}>
          {viewMode === "hierarchical" ? (
            <>
              <button type="button" className={styles.secondaryButton} onClick={handleExpandProblems}>
                Expand problems
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleExpandAll}>
                Expand all
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleCollapseAll}>
                Collapse all
              </button>
            </>
          ) : null}
        </div>
        <div
          className={styles.tableWrap}
          ref={tableWrapRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {viewMode === "flat" ? (
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
              {!loading && filteredDevices.length > 0 ? (
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
                        {entry.dataQuality.missingCritical.length > 0 ||
                        entry.dataQuality.missingOptional.length > 0 ? (
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
            </table>
          ) : null}
          {viewMode === "hierarchical" ? (
            <div className={styles.treeWrap}>
              {loading ? <div className={styles.treeEmpty}>Loading devices...</div> : null}
              {!loading && filteredDevices.length === 0 ? (
                <div className={styles.treeEmpty}>No devices found.</div>
              ) : null}
              {!loading && filteredDevices.length > 0 ? renderTreeRows(hierarchyTree) : null}
            </div>
          ) : null}
        </div>
      </section>

      <DeviceDetailsDrawer
        device={selectedDevice}
        health={selectedDevice?.health ?? { status: "offline" }}
        expectedRate={selectedDevice?.expectedRate}
        isOpen={Boolean(selectedDevice)}
        onClose={() => {
          setSelectedDeviceKey("");
          setDebugOpen(false);
        }}
        onDebug={() => setDebugOpen(true)}
        allowDebug={isDebugAllowed}
        messages={selectedMessages}
        metrics={selectedTrendData}
        healthReasons={selectedHealthReasons}
        timeWindowMs={timeWindowMs}
        onTimeWindowChange={setTimeWindowMs}
        timeWindowOptions={TIME_WINDOW_OPTIONS}
        nowMs={nowMs}
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
