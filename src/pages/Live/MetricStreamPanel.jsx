import React, {useEffect, useMemo, useRef, useState} from "react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import styles from "./MetricStreamPanel.module.css";
import {makeMeasurementKey, sanitize} from "../common/measurementUtils.js";
import {authFetch} from "../../api/http.js";
import {useAuth} from "../../context/AuthContext.jsx";

const MAX_POINTS = 480;
const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? import.meta.env?.VITE_API_BASE ?? "";
const STREAM_URL = import.meta?.env?.VITE_METRIC_STREAM_URL || `${API_BASE}/api/metrics/stream`;
const HISTORY_URL = import.meta?.env?.VITE_METRIC_HISTORY_URL || `${API_BASE}/api/metrics/history`;
const RETRY_MIN = 2000;
const RETRY_MAX = 30000;

function formatTime(ts) {
    if (!Number.isFinite(ts)) return "-";
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"});
}

function buildBufferKey(compositeId, metricKey) {
    return `${compositeId || "global"}::${metricKey}`;
}

function normalizeMetricEvent(rawEvent) {
    if (!rawEvent || typeof rawEvent !== "object") return null;

    const compositeId = rawEvent.compositeId || rawEvent.deviceId || rawEvent.device || rawEvent.topic || "";
    const normalizedType = sanitize(rawEvent.metric || rawEvent.measurementType || rawEvent.type);
    const normalizedModel = sanitize(rawEvent.sensorModel || rawEvent.source || rawEvent.sensorName) || normalizedType;
    const metricKey = rawEvent.metricKey || rawEvent.measurementKey || (normalizedType ? makeMeasurementKey(normalizedType, normalizedModel) : null);
    const value = Number(rawEvent.value ?? rawEvent.metricValue ?? rawEvent.data ?? rawEvent.y);
    const timestamp = Number(rawEvent.timestamp ?? rawEvent.time ?? rawEvent.ts ?? Date.now());

    if (!metricKey || !Number.isFinite(value) || !Number.isFinite(timestamp)) return null;

    return {compositeId, metricKey, value, timestamp};
}

function MetricStreamPanel({selectedCompositeId, selectedMetricKey, metricLabel, metricUnit}) {
    const {isAuthenticated, loadingProfile, token} = useAuth();
    const bufferRef = useRef(new Map());
    const rafRef = useRef(null);
    const retryRef = useRef(RETRY_MIN);
    const reconnectTimerRef = useRef(null);
    const streamAbortRef = useRef(null);
    const isVisibleRef = useRef(typeof document === "undefined" ? true : !document.hidden);

    const [chartData, setChartData] = useState([]);
    const [connectionState, setConnectionState] = useState("idle");
    const [lastUpdate, setLastUpdate] = useState(null);
    const [historyError, setHistoryError] = useState("");
    const [streamError, setStreamError] = useState("");

    const targetBufferKey = useMemo(() => {
        if (!selectedCompositeId || !selectedMetricKey) return "";
        return buildBufferKey(selectedCompositeId, selectedMetricKey);
    }, [selectedCompositeId, selectedMetricKey]);

    const scheduleRender = () => {
        if (!isVisibleRef.current) return;
        if (rafRef.current) return;

        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const buffer = targetBufferKey ? (bufferRef.current.get(targetBufferKey) || []) : [];
            setChartData([...buffer]);
        });
    };

    const addPointToBuffer = (bufferKey, point) => {
        const existing = bufferRef.current.get(bufferKey) || [];
        const next = [...existing, point];
        if (next.length > MAX_POINTS) {
            next.splice(0, next.length - MAX_POINTS);
        }
        bufferRef.current.set(bufferKey, next);

        if (bufferKey === targetBufferKey) {
            scheduleRender();
        }
    };

    const handleVisibilityChange = () => {
        isVisibleRef.current = typeof document === "undefined" ? true : !document.hidden;
        if (isVisibleRef.current) {
            scheduleRender();
        }
    };

    useEffect(() => {
        scheduleRender();
    }, [targetBufferKey]);

    useEffect(() => {
        if (typeof document === "undefined") return undefined;
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    useEffect(() => {
        if (!targetBufferKey) {
            setChartData([]);
            return;
        }

        if (loadingProfile) {
            return;
        }

        if (!isAuthenticated || !token) {
            setHistoryError("Sign in to view history data.");
            return;
        }

        const abortController = new AbortController();
        const {signal} = abortController;

    const fetchHistory = async () => {
        try {
            setHistoryError("");
            if (import.meta.env?.MODE === "development") {
                console.info("[MetricStreamPanel] history token present:", Boolean(token));
                }
                const params = new URLSearchParams({
                    compositeId: selectedCompositeId || "",
                    metricKey: selectedMetricKey || "",
                    limit: String(MAX_POINTS),
            });
            const url = `${HISTORY_URL}?${params.toString()}`;
            const response = await authFetch(url, {signal});
            if (response.status === 401) {
                setHistoryError("Session expired. Please sign in again.");
                return;
            }
            if (!response.ok) throw new Error(`History request failed (${response.status})`);

                const rawBody = await response.text();
                if (!rawBody) {
                    bufferRef.current.set(targetBufferKey, []);
                    scheduleRender();
                    return;
                }

                const payload = JSON.parse(rawBody);
                const items = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
                const points = items
                    .map(normalizeMetricEvent)
                    .filter(Boolean)
                    .filter(event => !selectedCompositeId || event.compositeId === selectedCompositeId)
                    .filter(event => event.metricKey === selectedMetricKey)
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map(event => ({timestamp: event.timestamp, value: event.value}));

                if (signal.aborted) return;
                bufferRef.current.set(targetBufferKey, points);
                scheduleRender();
                retryRef.current = RETRY_MIN;
            } catch {
                if (!signal.aborted) {
                    setHistoryError("Unable to load history data");
                }
            }
        };

        fetchHistory();
        return () => abortController.abort();
    }, [isAuthenticated, loadingProfile, selectedCompositeId, selectedMetricKey, targetBufferKey, token]);

    useEffect(() => {
        let cancelled = false;
        const cleanup = () => {
            if (streamAbortRef.current) {
                streamAbortRef.current.abort();
                streamAbortRef.current = null;
            }
        };

        const scheduleRetry = () => {
            cleanup();
            if (cancelled) return;
            const delay = retryRef.current;
            reconnectTimerRef.current = setTimeout(connect, delay);
            retryRef.current = Math.min(delay * 2, RETRY_MAX);
            setConnectionState("reconnecting");
        };

        const handleMessage = (payload) => {
            const parsed = normalizeMetricEvent(payload);
            if (!parsed) return;
            if (selectedCompositeId && parsed.compositeId && parsed.compositeId !== selectedCompositeId) return;
            if (selectedMetricKey && parsed.metricKey !== selectedMetricKey) return;

            const bufferKey = buildBufferKey(parsed.compositeId, parsed.metricKey);
            addPointToBuffer(bufferKey, {timestamp: parsed.timestamp, value: parsed.value});
            setLastUpdate(parsed.timestamp);
        };

        const handleIncomingData = (data) => {
            let parsed = data;
            try {
                parsed = typeof data === "string" ? JSON.parse(data) : data;
            } catch {
                parsed = null;
            }
            if (Array.isArray(parsed)) {
                parsed.forEach(item => handleMessage(item));
            } else {
                handleMessage(parsed);
            }
        };

    const connect = () => {
        if (cancelled) return;
        cleanup();
        setStreamError("");

        if (loadingProfile) {
            setConnectionState("idle");
            return;
        }

        if (!isAuthenticated || !token) {
            setStreamError("Sign in to view live metrics.");
            setConnectionState("idle");
            return;
        }

        setConnectionState(prev => (prev === "open" ? "open" : "connecting"));

        try {
            if (import.meta.env?.MODE === "development") {
                console.info("[MetricStreamPanel] stream token present:", Boolean(token));
            }

                if (!STREAM_URL) {
                    return;
                }

                const controller = new AbortController();
                streamAbortRef.current = controller;

                authFetch(STREAM_URL, {
                    signal: controller.signal,
                    headers: {Accept: "text/event-stream"},
                })
                    .then(async (response) => {
                        if (controller.signal.aborted) return;
                        if (response.status === 401) {
                            setStreamError("Session expired. Please sign in again.");
                            return;
                        }
                        if (!response.ok) {
                            throw new Error(`Stream request failed (${response.status})`);
                        }
                        if (!response.body) {
                            throw new Error("Stream response body unavailable");
                        }

                        retryRef.current = RETRY_MIN;
                        setConnectionState("open");

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        let buffer = "";

                        while (!cancelled) {
                            const {value, done} = await reader.read();
                            if (done) break;
                            buffer += decoder.decode(value, {stream: true});
                            const parts = buffer.split(/\n\n/);
                            buffer = parts.pop() ?? "";
                            parts.forEach((chunk) => {
                                const lines = chunk.split(/\r?\n/);
                                const dataLines = lines
                                    .filter((line) => line.startsWith("data:"))
                                    .map((line) => line.replace(/^data:\s?/, ""));
                                if (dataLines.length > 0) {
                                    handleIncomingData(dataLines.join("\n"));
                                }
                            });
                        }

                        if (!cancelled && !controller.signal.aborted) {
                            scheduleRetry();
                        }
                    })
                    .catch(() => {
                        if (!cancelled && !controller.signal.aborted) {
                            scheduleRetry();
                        }
                    });
            } catch {
                scheduleRetry();
            }
        };

        connect();

        return () => {
            cancelled = true;
            cleanup();
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [isAuthenticated, loadingProfile, selectedCompositeId, selectedMetricKey, token]);

    const statusLabel = useMemo(() => {
        switch (connectionState) {
        case "open":
            return "Live";
        case "reconnecting":
            return "Reconnecting";
        case "connecting":
            return "Connecting";
        default:
            return "Idle";
        }
    }, [connectionState]);

    const yAxisLabel = useMemo(() => {
        if (!metricLabel) return "Value";
        return metricUnit ? `${metricLabel} (${metricUnit})` : metricLabel;
    }, [metricLabel, metricUnit]);

    return (
        <div className={styles.wrapper}>
            <div className={styles.statusRow}>
                <div className={`${styles.statusDot} ${styles[connectionState] || ""}`} aria-label="stream status" />
                <span className={styles.statusText}>{statusLabel}</span>
                <span className={styles.statusSubdued}>
                    {lastUpdate ? `Last update ${formatTime(lastUpdate)}` : "Waiting for updates"}
                </span>
            </div>

            {(historyError || streamError) && (
                <div className={styles.errorBanner}>
                    {historyError && `History unavailable: ${historyError}`}
                    {historyError && streamError ? " " : ""}
                    {streamError && `Live stream unavailable: ${streamError}`}
                </div>
            )}

            {!targetBufferKey && (
                <div className={styles.chartEmpty}>Select a device and metric to start streaming.</div>
            )}

            {targetBufferKey && (
                <ResponsiveContainer width="100%" height={360} debounce={100}>
                    <LineChart data={chartData} margin={{ top: 16, right: 28, bottom: 28, left: 16 }}>
                        <CartesianGrid stroke="#1f2a44" strokeDasharray="4 4" />
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            tickFormatter={formatTime}
                            stroke="#2b3c5c"
                            tick={{ fontSize: 12, fill: "#1f2d4d", fontWeight: 500 }}
                            allowDataOverflow
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: "#1f2d4d", fontWeight: 500 }}
                            stroke="#2b3c5c"
                            tickLine={{ stroke: "#2b3c5c" }}
                            domain={["auto", "auto"]}
                        />
                        <Tooltip
                            cursor={{ stroke: "#6f9bff", strokeDasharray: "5 5" }}
                            contentStyle={{
                                backgroundColor: "rgba(7, 15, 32, 0.94)",
                                border: "1px solid #31507f",
                                borderRadius: 8,
                                color: "#e4ecff",
                                boxShadow: "0 12px 28px rgba(4, 11, 26, 0.55)",
                            }}
                            labelFormatter={(value) => `Time: ${formatTime(value)}`}
                            formatter={(value) => [value, yAxisLabel]}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#7fb5ff"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            connectNulls
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

export default MetricStreamPanel;
