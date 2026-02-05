import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Header from "../../common/Header";
import { listDevices } from "../../../api/deviceMonitoring.js";
import { useStomp } from "../../../hooks/useStomp.js";
import { buildDeviceKey, isIdentityComplete, resolveIdentity } from "../../../utils/deviceIdentity.js";
import { WS_TOPICS } from "../../common/dashboard.constants.js";
import DeviceStatusBadge from "./DeviceStatusBadge.jsx";
import DeviceFilters from "./DeviceFilters.jsx";
import JsonStreamViewer from "./JsonStreamViewer.jsx";
import styles from "./Overview.module.css";

const ONLINE_THRESHOLD_SEC = 30;
const STALE_THRESHOLD_SEC = 120;
const STREAM_BUFFER_LIMIT = 200;

const getTimestampMs = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeDevice = (device) => {
  const normalized = {
    farmId: device?.farmId ?? device?.farm_id ?? "",
    unitType: device?.unitType ?? device?.unit_type ?? "",
    unitId: device?.unitId ?? device?.unit_id ?? "",
    layerId: device?.layerId ?? device?.layer_id ?? "",
    deviceId: device?.deviceId ?? device?.device_id ?? "",
    lastSeenMs: getTimestampMs(device?.lastSeen ?? device?.timestamp ?? device?.updatedAt),
    lastKind: device?.kind ?? "",
    errorFlag: Boolean(device?.errorFlag ?? device?.hasError ?? device?.error),
    msgTimes: [],
    msgRate: 0,
  };

  normalized.key = buildDeviceKey(normalized);
  return normalized;
};

const resolveDeviceStatus = (entry) => {
  if (!entry) return "offline";
  if (entry.errorFlag) return "error";
  if (!entry.lastSeenMs) return "offline";
  const secondsAgo = (Date.now() - entry.lastSeenMs) / 1000;
  if (secondsAgo <= ONLINE_THRESHOLD_SEC) return "online";
  if (secondsAgo <= STALE_THRESHOLD_SEC) return "stale";
  return "offline";
};

const formatLastSeen = (timestamp) => {
  if (!timestamp) return "Never";
  return new Date(timestamp).toLocaleString();
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

export default function Overview() {
  const [devicesMap, dispatchDevices] = useReducer(devicesReducer, new Map());
  const [search, setSearch] = useState("");
  const [selectedDeviceKey, setSelectedDeviceKey] = useState("");
  const [viewerPaused, setViewerPaused] = useState(false);
  const [filters, setFilters] = useState({ farmId: "", unitType: "", unitId: "", kind: "", status: "" });
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [wsBanner, setWsBanner] = useState("");
  const [messageBuffers, setMessageBuffers] = useState({});

  const pendingUpdatesRef = useRef(new Map());
  const rafRef = useRef(0);

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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadDevices = async () => {
      setLoading(true);
      setErrorBanner("");
      try {
        const payload = await listDevices({ signal: controller.signal });
        if (cancelled) return;
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

        dispatchDevices({ type: "seed", payload: seeded });
        if (hasMissingRequiredFields) {
          setErrorBanner("Some devices are missing required identity fields from API data.");
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        console.error("Failed to load devices", error);
        setErrorBanner("Unable to load device inventory.");
        dispatchDevices({ type: "seed", payload: new Map() });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDevices();

    return () => {
      cancelled = true;
      controller.abort();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [flushPending]);

  const onMessage = useCallback(
    (topic, message) => {
      setWsBanner("");
      const envelope = message && typeof message === "object" ? message : {};
      let payload = envelope.payload ?? message;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
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
      const kind = String(payload.kind ?? envelope.kind ?? topic.split("/").pop() ?? "").toLowerCase();
      const existing = devicesMap.get(key);
      const msgTimes = [...(existing?.msgTimes || []), timestampMs].filter((value) => timestampMs - value <= 60_000).slice(-400);
      const msgRate = msgTimes.length;

      queueUpdate(key, {
        farmId: identity.farmId,
        unitType: identity.unitType,
        unitId: identity.unitId,
        layerId: identity.layerId ?? "",
        deviceId: identity.deviceId,
        key,
        lastSeenMs: timestampMs,
        msgTimes,
        msgRate,
        lastKind: kind,
        errorFlag: Boolean(payload.errorFlag ?? envelope.errorFlag ?? existing?.errorFlag),
      });

      if (selectedDeviceKey === key && !viewerPaused) {
        setMessageBuffers((prev) => {
          const current = Array.isArray(prev[key]) ? prev[key] : [];
          const nextEntry = {
            id: `${timestampMs}-${current.length}-${Math.random().toString(36).slice(2)}`,
            kind,
            timestamp: timestampMs,
            receivedAt: Date.now(),
            raw: {
              ...identity,
              kind,
              timestamp: payload.timestamp ?? envelope.timestamp ?? new Date(timestampMs).toISOString(),
              payload,
            },
          };
          return {
            ...prev,
            [key]: [...current, nextEntry].slice(-STREAM_BUFFER_LIMIT),
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

  const farmOptions = useMemo(() => Array.from(new Set(devices.map((entry) => entry.farmId).filter(Boolean))).sort(), [devices]);
  const unitTypeOptions = useMemo(() => {
    const filteredByFarm = filters.farmId ? devices.filter((entry) => entry.farmId === filters.farmId) : devices;
    return Array.from(new Set(filteredByFarm.map((entry) => entry.unitType).filter(Boolean))).sort();
  }, [devices, filters.farmId]);
  const unitIdOptions = useMemo(() => {
    const filtered = devices.filter((entry) => {
      if (filters.farmId && entry.farmId !== filters.farmId) return false;
      if (filters.unitType && entry.unitType !== filters.unitType) return false;
      return true;
    });
    return Array.from(new Set(filtered.map((entry) => entry.unitId).filter(Boolean))).sort();
  }, [devices, filters.farmId, filters.unitType]);

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return devices
      .filter((entry) => {
        if (filters.farmId && entry.farmId !== filters.farmId) return false;
        if (filters.unitType && entry.unitType !== filters.unitType) return false;
        if (filters.unitId && entry.unitId !== filters.unitId) return false;
        if (filters.kind && entry.lastKind !== filters.kind) return false;
        const status = resolveDeviceStatus(entry);
        if (filters.status && status !== filters.status) return false;
        if (!query) return true;
        const haystack = `${entry.farmId} ${entry.unitType} ${entry.unitId} ${entry.layerId || ""} ${entry.deviceId}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (a.lastSeenMs && b.lastSeenMs) return b.lastSeenMs - a.lastSeenMs;
        if (a.lastSeenMs) return -1;
        if (b.lastSeenMs) return 1;
        return String(a.deviceId).localeCompare(String(b.deviceId));
      });
  }, [devices, filters, search]);

  const selectedDevice = selectedDeviceKey ? devicesMap.get(selectedDeviceKey) : null;
  const selectedMessages = selectedDeviceKey ? messageBuffers[selectedDeviceKey] || [] : [];

  return (
    <div className={styles.page}>
      <Header title="Device Monitor" />

      {errorBanner ? <div className={styles.bannerError}>{errorBanner}</div> : null}
      {wsBanner ? <div className={styles.bannerWarn}>{wsBanner}</div> : null}

      <section className={styles.card}>
        <DeviceFilters
          search={search}
          onSearch={setSearch}
          filterState={filters}
          onFilterChange={(field, value) => setFilters((prev) => ({ ...prev, [field]: value }))}
          farmOptions={farmOptions}
          unitTypeOptions={unitTypeOptions}
          unitIdOptions={unitIdOptions}
        />
      </section>

      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>farmId</th>
                <th>unitType</th>
                <th>unitId</th>
                <th>layerId</th>
                <th>deviceId</th>
                <th>lastSeen</th>
                <th>status</th>
                <th>msgRate</th>
                <th>lastKind</th>
                <th>actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>Loading devices...</td>
                </tr>
              ) : null}
              {!loading && filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={10}>No devices found.</td>
                </tr>
              ) : null}
              {filteredDevices.map((entry) => (
                <tr key={entry.key}>
                  <td>{entry.farmId}</td>
                  <td>{entry.unitType}</td>
                  <td>{entry.unitId}</td>
                  <td>{entry.layerId || "-"}</td>
                  <td>{entry.deviceId}</td>
                  <td>{formatLastSeen(entry.lastSeenMs)}</td>
                  <td>
                    <DeviceStatusBadge status={resolveDeviceStatus(entry)} />
                  </td>
                  <td>{entry.msgRate}/min</td>
                  <td>{entry.lastKind || "-"}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => setSelectedDeviceKey(entry.key)}
                    >
                      Open live JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <JsonStreamViewer
        device={selectedDevice}
        isOpen={Boolean(selectedDevice)}
        messages={selectedMessages}
        paused={viewerPaused}
        onPauseToggle={() => setViewerPaused((prev) => !prev)}
        onClear={() => selectedDeviceKey && setMessageBuffers((prev) => ({ ...prev, [selectedDeviceKey]: [] }))}
        onClose={() => setSelectedDeviceKey("")}
      />
    </div>
  );
}
