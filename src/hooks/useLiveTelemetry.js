import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStomp } from "./useStomp.js";
import { normalizeTelemetryPayload, parseEnvelope } from "../utils/telemetryAdapter.js";
import { canonKey, normalizeSensors } from "../pages/Overview/utils/index.js";
import { deviceMatchesRack, normalizeRackId } from "../pages/RackDashboard/rackTelemetry.js";

const DEFAULT_TELEMETRY_TOPIC = "hydroleaf/telemetry";
const BATCH_INTERVAL_MS = 300;

const normalizeList = (items, { keyResolvers = [], normalizer = (value) => value } = {}) => {
    if (!items) return [];
    const list = Array.isArray(items) ? items : [items];
    const seen = new Set();
    return list
        .map((entry) => {
            if (!entry) return null;
            if (typeof entry === "string" || typeof entry === "number") {
                return normalizer(String(entry).trim());
            }
            for (const resolver of keyResolvers) {
                const value = resolver(entry);
                if (value) return normalizer(String(value).trim());
            }
            return null;
        })
        .filter((value) => {
            if (!value) return false;
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
};

const resolveNodeId = (payload, envelope) => {
    return (
        payload?.nodeId ||
        payload?.node ||
        payload?.deviceId ||
        payload?.device ||
        payload?.devId ||
        payload?.compositeId ||
        payload?.composite_id ||
        envelope?.compositeId ||
        null
    );
};

const resolveTimestamp = (payload) => {
    const value = payload?.timestamp ?? payload?.ts ?? payload?.time ?? payload?.receivedAt;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Date.now();
};

const resolveMetricsPayload = (payload) => {
    if (!payload || typeof payload !== "object") return {};
    if (payload.metric && payload.value !== undefined) {
        return {
            [payload.metric]: {
                value: payload.value,
                unit: payload.unit,
            },
        };
    }

    if (payload.metrics && typeof payload.metrics === "object") {
        return normalizeSensors(payload.metrics);
    }

    if (Array.isArray(payload.sensors)) {
        return normalizeSensors(payload.sensors);
    }

    if (payload.values && typeof payload.values === "object") {
        return normalizeSensors(payload.values);
    }

    if (payload.payload && typeof payload.payload === "object") {
        return normalizeSensors(payload.payload);
    }

    if (payload.data && typeof payload.data === "object") {
        return normalizeSensors(payload.data);
    }

    return {};
};

const filterMetrics = (metrics, allowedKeys) => {
    if (!allowedKeys || allowedKeys.size === 0) return metrics;
    const filtered = {};
    Object.entries(metrics).forEach(([key, value]) => {
        if (!allowedKeys.has(key)) return;
        filtered[key] = value;
    });
    return filtered;
};

const buildTelemetryTopics = ({ rackId, nodeIds, metricKeys }) => {
    const base = DEFAULT_TELEMETRY_TOPIC;
    const normalizedRackId = normalizeRackId(rackId);
    if (!normalizedRackId) {
        return [base];
    }

    const rackBase = `${base}/${normalizedRackId}`;
    if (!nodeIds.length && !metricKeys.length) {
        return [rackBase];
    }
    if (!nodeIds.length) {
        return metricKeys.map((metric) => `${rackBase}/${metric}`);
    }
    if (!metricKeys.length) {
        return nodeIds.map((nodeId) => `${rackBase}/${nodeId}`);
    }
    return nodeIds.flatMap((nodeId) =>
        metricKeys.map((metric) => `${rackBase}/${nodeId}/${metric}`),
    );
};

export function useLiveTelemetry({ rackId, selectedNodes, metrics } = {}) {
    const [telemetryByNode, setTelemetryByNode] = useState({});
    const pendingUpdatesRef = useRef(new Map());
    const flushTimeoutRef = useRef(null);

    const normalizedRackId = useMemo(() => normalizeRackId(rackId), [rackId]);

    const nodeIds = useMemo(
        () =>
            normalizeList(selectedNodes, {
                keyResolvers: [
                    (entry) => entry?.nodeId,
                    (entry) => entry?.id,
                    (entry) => entry?.compositeId,
                    (entry) => entry?.deviceId,
                    (entry) => entry?.value,
                ],
            }),
        [selectedNodes],
    );

    const metricKeys = useMemo(
        () =>
            normalizeList(metrics, {
                keyResolvers: [
                    (entry) => entry?.metricKey,
                    (entry) => entry?.key,
                    (entry) => entry?.id,
                    (entry) => entry?.name,
                    (entry) => entry?.metric,
                    (entry) => entry?.valueType,
                ],
                normalizer: (value) => canonKey(value) || value,
            }),
        [metrics],
    );

    const nodeSet = useMemo(() => new Set(nodeIds), [nodeIds]);
    const metricSet = useMemo(() => new Set(metricKeys), [metricKeys]);

    const topics = useMemo(
        () => buildTelemetryTopics({ rackId: normalizedRackId, nodeIds, metricKeys }),
        [metricKeys, nodeIds, normalizedRackId],
    );

    const flushUpdates = useCallback(() => {
        if (flushTimeoutRef.current) return;
        flushTimeoutRef.current = setTimeout(() => {
            const pending = pendingUpdatesRef.current;
            pendingUpdatesRef.current = new Map();
            flushTimeoutRef.current = null;
            if (pending.size === 0) return;

            setTelemetryByNode((prev) => {
                let next = prev;
                pending.forEach((update, nodeId) => {
                    const existing = prev[nodeId] || {};
                    const nextMetrics = {
                        ...(existing.metrics || {}),
                        ...(update.metrics || {}),
                    };
                    const nextEntry = {
                        ...existing,
                        ...update,
                        metrics: nextMetrics,
                        lastUpdate: Math.max(existing.lastUpdate || 0, update.lastUpdate || 0),
                    };
                    if (next === prev) {
                        next = {...prev};
                    }
                    next[nodeId] = nextEntry;
                });
                return next;
            });
        }, BATCH_INTERVAL_MS);
    }, []);

    const handleMessage = useCallback(
        (_topic, message) => {
            const envelope = parseEnvelope(message);
            const telemetry = normalizeTelemetryPayload(envelope);
            const payload = telemetry || envelope?.payload || message;
            if (!payload || typeof payload !== "object") return;

            if (normalizedRackId && !deviceMatchesRack(payload, normalizedRackId)) {
                return;
            }

            const nodeId = resolveNodeId(payload, envelope);
            if (!nodeId) return;
            const normalizedNodeId = String(nodeId).trim();
            if (nodeSet.size > 0 && !nodeSet.has(normalizedNodeId)) return;

            const metricsPayload = resolveMetricsPayload(payload);
            const filtered = filterMetrics(metricsPayload, metricSet);
            if (!filtered || Object.keys(filtered).length === 0) return;

            const timestamp = resolveTimestamp(payload);

            const pendingEntry = pendingUpdatesRef.current.get(normalizedNodeId) || {};
            pendingUpdatesRef.current.set(normalizedNodeId, {
                ...pendingEntry,
                metrics: { ...(pendingEntry.metrics || {}), ...filtered },
                lastUpdate: Math.max(pendingEntry.lastUpdate || 0, timestamp),
                nodeId: normalizedNodeId,
                rackId: normalizedRackId || pendingEntry.rackId,
            });
            flushUpdates();
        },
        [flushUpdates, metricSet, nodeSet, normalizedRackId],
    );

    useStomp(topics, handleMessage);

    useEffect(() => {
        setTelemetryByNode({});
    }, [normalizedRackId, nodeIds, metricKeys]);

    useEffect(() => {
        return () => {
            if (flushTimeoutRef.current) {
                clearTimeout(flushTimeoutRef.current);
            }
        };
    }, []);

    return { telemetryByNode, topics };
}
