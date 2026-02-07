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
  buildHealthReasons,
  computeMetricTrend,
  getWorstHealthStatus,
  KEY_METRICS_BY_KIND,
  normalizeDeviceKind,
  resolveExpectedConfig,
} from "../utils/deviceHealth.js";
import styles from "./Overview.module.css";

const REFRESH_INTERVAL_MS = 5000;
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
    deviceKind: normalizeDeviceKind(
      device?.deviceType ??
        device?.device_type ??
        device?.deviceKind ??
        device?.device_kind ??
        device?.kind ??
        device?.type,
    ),
    lastSeenMs: getTimestampMs(device?.lastSeen ?? device?.timestamp ?? device?.updatedAt),
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

const buildHierarchyTree = (devices) => {
  const root = {
    id: "root",
    label: "All",
    level: "root",
    children: new Map(),
    devices: [],
  };

  devices.forEach((device) => {
    const farm = device.farmId || "—";
    const unitType = String(device.unitType || "—").toUpperCase();
    const unitId = device.unitId || "—";
    const kind = device.deviceKind || "UNKNOWN";
    const chain = [
      { level: "farm", label: farm },
      { level: "unitType", label: unitType },
      { level: "unitId", label: unitId },
      { level: "kind", label: kind },
    ];

    let cursor = root;
    chain.forEach((entry) => {
      const key = `${entry.level}-${entry.label}`;
      if (!cursor.children.has(key)) {
        cursor.children.set(key, {
          id: key,
          label: entry.label,
          level: entry.level,
          children: new Map(),
          devices: [],
        });
      }
      cursor = cursor.children.get(key);
    });

    cursor.devices.push(device);
  });

  const toNodeList = (node, depth = 0) => {
    const children = Array.from(node.children.values()).map((child) => toNodeList(child, depth + 1));
    return {
      ...node,
      depth,
      children,
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
        msgTimes,
        msgRate,
        lastMessageKind: messageKind,
        payloadError: payloadError || existing?.payloadError,
        latestMetrics: Object.keys(metrics).length ? metrics : existing?.latestMetrics,
      });

      if (Object.keys(metrics || {}).length) {
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
    onDisconnect: () => setWsBanner("Live stream disconnected. Attempting to reconnect..."),
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

  const handleToggleNode = (nodeId) => {
    setTreeExpanded((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleExpandAll = () => {
    const expanded = {};
    allTreeNodes.forEach((node) => {
      expanded[node.id] = true;
    });
    setTreeExpanded(expanded);
  };

  const handleCollapseAll = () => {
    const collapsed = {};
    allTreeNodes.forEach((node) => {
      collapsed[node.id] = false;
    });
    setTreeExpanded(collapsed);
  };

  const renderTreeRows = (node) =>
    node.children.flatMap((child) => {
      const { counts, worst } = aggregateTreeCounts(child);
      const isExpanded = treeExpanded[child.id] ?? child.level === "farm";
      const rows = [
        <tr key={child.id} className={styles.treeRow}>
          <td colSpan={8}>
            <button type="button" className={styles.treeToggle} onClick={() => handleToggleNode(child.id)}>
              <span className={`${styles.treeChevron} ${isExpanded ? styles.treeChevronOpen : ""}`} />
              <span className={styles.treeLabel} style={{ paddingLeft: `${child.depth * 18}px` }}>
                {child.label}
              </span>
              <DeviceStatusBadge status={worst} />
              <span className={styles.treeCounts}>
                OK {counts.ok} • Degraded {counts.degraded} • Critical {counts.critical} • Offline {counts.offline}
              </span>
            </button>
          </td>
        </tr>,
      ];

      if (isExpanded) {
        if (child.children.length > 0) {
          rows.push(...renderTreeRows(child));
        } else {
          rows.push(
            ...child.devices.map((entry) => (
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
            )),
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
            {!loading && filteredDevices.length > 0 && viewMode === "hierarchical" ? (
              <tbody>{renderTreeRows(hierarchyTree)}</tbody>
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
