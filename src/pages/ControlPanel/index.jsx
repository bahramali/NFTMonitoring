import React, { useEffect, useMemo, useState } from "react";
import { sendLedCommand, sendLedSchedule } from "../../api/actuators";
import { fetchLayerStatus } from "../../api/status";
import Header from "../common/Header";
import styles from "./ControlPanel.module.css";

const layerPresets = [
    { id: "L01", name: "Layer 01" },
    { id: "L02", name: "Layer 02" },
    { id: "L03", name: "Layer 03" },
    { id: "L04", name: "Layer 04" },
];

const defaultSchedule = { start: "07:00", durationHours: 12 };

const parseTime = (value) => {
    if (typeof value !== "string" || !value.includes(":")) return null;
    const [hoursStr, minutesStr] = value.split(":");
    const hours = Number.parseInt(hoursStr, 10);
    const minutes = Number.parseInt(minutesStr, 10);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    return { hours, minutes };
};

const formatTimestamp = (value) => {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const deriveLayerStatus = (payload) => {
    if (!payload || typeof payload !== "object") {
        return { state: "Unknown", raw: null, updatedAt: null };
    }

    const candidates = [
        payload.status,
        payload?.average?.status,
        payload?.average?.value,
        payload?.value,
        payload?.sensorValue,
    ];

    const found = candidates.find((candidate) => typeof candidate !== "undefined" && candidate !== null);
    const normalized =
        typeof found === "string"
            ? found.toUpperCase()
            : Number.isFinite(Number(found))
                ? Number(found) > 0
                    ? "ON"
                    : "OFF"
                : "Unknown";

    const updatedAt = payload.timestamp ?? payload.time ?? payload.updatedAt ?? null;

    return { state: normalized, raw: payload, updatedAt };
};

function ControlPanel() {
    const [layers, setLayers] = useState(
        layerPresets.map((layer) => ({
            ...layer,
            mode: "AUTO",
            updatedAt: null,
            schedule: { ...defaultSchedule },
            durationSec: "",
            status: "Unknown",
            statusUpdatedAt: null,
        }))
    );
    const [busyLayer, setBusyLayer] = useState(null);
    const [sendingSchedule, setSendingSchedule] = useState(false);
    const [feedback, setFeedback] = useState({ status: "idle", message: "" });

    const activeModes = useMemo(
        () => layers.reduce((map, layer) => ({ ...map, [layer.id]: layer.mode }), {}),
        [layers]
    );

    const updateLayer = (layerId, updater) => {
        setLayers((prev) =>
            prev.map((layer) => (layer.id === layerId ? { ...layer, ...updater(layer) } : layer))
        );
    };

    const updateLayerMode = (layerId, mode) => {
        updateLayer(layerId, (layer) => ({ mode, updatedAt: new Date(), status: mode }));
    };

    const refreshLayerStatus = async (layerId) => {
        try {
            const response = await fetchLayerStatus({ system: "S01", layer: layerId });
            const status = deriveLayerStatus(response);
            updateLayer(layerId, () => ({
                status: status.state,
                statusUpdatedAt: status.updatedAt ? new Date(status.updatedAt) : new Date(),
                updatedAt: status.updatedAt ? new Date(status.updatedAt) : new Date(),
            }));
        } catch (error) {
            console.error(`Could not refresh status for ${layerId}`, error);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        async function loadLayerStatuses() {
            setFeedback({ status: "pending", message: "Loading LED status..." });
            try {
                const results = await Promise.all(
                    layerPresets.map((layer) =>
                        fetchLayerStatus({ system: "S01", layer: layer.id, signal: controller.signal })
                            .then((payload) => deriveLayerStatus(payload))
                            .catch(() => ({ state: "Unknown", raw: null, updatedAt: null }))
                    )
                );

                if (cancelled) return;

                setLayers((prev) =>
                    prev.map((layer, index) => ({
                        ...layer,
                        status: results[index].state,
                        statusUpdatedAt: results[index].updatedAt
                            ? new Date(results[index].updatedAt)
                            : layer.statusUpdatedAt,
                    }))
                );
                setFeedback({ status: "idle", message: "" });
            } catch (error) {
                if (error?.name === "AbortError") return;
                setFeedback({ status: "error", message: "Could not load LED status." });
            }
        }

        loadLayerStatuses();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    const handleLayerCommand = async (layerId, command) => {
        setBusyLayer(layerId);
        setFeedback({ status: "pending", message: "Sending command..." });

        try {
            const payload = {
                system: "S01",
                layer: layerId,
                deviceId: "R01",
                command,
            };
            const layer = layers.find((entry) => entry.id === layerId);
            if (layer?.durationSec) {
                payload.durationSec = Number(layer.durationSec);
            }
            const response = await sendLedCommand(payload);
            setFeedback({
                status: "success",
                message: response?.message ?? `${command} command sent for ${layerId}`,
            });
            updateLayerMode(layerId, command);
            await refreshLayerStatus(layerId);
        } catch (error) {
            setFeedback({
                status: "error",
                message: error?.message ?? "Command could not be sent",
            });
        } finally {
            setBusyLayer(null);
        }
    };

    const handleScheduleSubmit = async (event, layerId) => {
        event.preventDefault();

        const layer = layers.find((item) => item.id === layerId);
        const start = parseTime(layer?.schedule?.start);

        if (!start || !Number.isFinite(Number(layer?.schedule?.durationHours))) {
            setFeedback({ status: "error", message: "Enter a valid start time and duration." });
            return;
        }

        const durationHours = Math.max(1, Math.round(Number(layer.schedule.durationHours)));

        setSendingSchedule(true);
        setFeedback({ status: "pending", message: `Sending lighting schedule for ${layerId}...` });

        try {
            const payload = {
                system: "S01",
                deviceId: "R01",
                layer: layerId,
                command: "SET_SCHEDULE",
                onHour: start.hours,
                onMinute: start.minutes,
                durationHours,
            };
            const response = await sendLedSchedule(payload);
            setFeedback({
                status: "success",
                message: response?.message ?? `Lighting schedule saved for ${layerId}.`,
            });
            await refreshLayerStatus(layerId);
        } catch (error) {
            setFeedback({
                status: "error",
                message: error?.message ?? "Could not save schedule.",
            });
        } finally {
            setSendingSchedule(false);
        }
    };

    return (
        <div className={styles.page}>
            <Header title="Control Panel" />

            <section className={styles.hero}>
                <div>
                    <h1 className={styles.title}>Layer Lighting Control</h1>
                    <p className={styles.subtitle}>
                        One relay equals one layer (L01–L04). Send manual ON/OFF/AUTO commands with optional
                        duration, or push a per-layer schedule to the command topic.
                    </p>
                    <p className={styles.subtitleSmall}>
                        Commands: <code>actuator/led/cmd</code> • Status topics per layer: <code>
                            actuator/led/status/LXX
                        </code>
                    </p>
                </div>
                <div className={`${styles.feedback} ${styles[feedback.status] || ""}`}>
                    <span className={styles.feedbackLabel}>Status</span>
                    <p className={styles.feedbackMessage}>
                        {feedback.status === "idle" && "Waiting for new command"}
                        {feedback.status === "pending" && feedback.message}
                        {feedback.status === "success" && feedback.message}
                        {feedback.status === "error" && feedback.message}
                    </p>
                </div>
            </section>

            <section className={styles.layerGrid}>
                {layers.map((layer) => (
                    <article key={layer.id} className={styles.layerCard}>
                        <div className={styles.layerHeader}>
                            <div>
                                <div className={styles.layerName}>{layer.name}</div>
                                <div className={styles.layerId}>{layer.id}</div>
                            </div>
                            <div className={`${styles.modeBadge} ${styles[layer.mode.toLowerCase()]}`}>
                                <span className={styles.modeBadgeLabel}>
                                    {layer.mode === "AUTO" ? "Auto" : layer.mode === "ON" ? "On" : "Off"}
                                </span>
                                {layer.mode === "AUTO" && (
                                    <span className={styles.modeBadgeMeta}>
                                        Starts {layer.schedule.start}, runs {layer.schedule.durationHours}h
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className={styles.statusRow}>
                            <div>
                                <div className={styles.statusLabel}>Current status</div>
                                <div className={styles.statusValue}>{layer.status}</div>
                            </div>
                            <div className={styles.statusMeta}>
                                <span>Last status</span>
                                <strong>{formatTimestamp(layer.statusUpdatedAt || layer.updatedAt)}</strong>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            {[
                                { label: "Off", value: "OFF", tone: "ghost" },
                                { label: "On", value: "ON", tone: "primary" },
                                { label: "Auto", value: "AUTO", tone: "neutral" },
                            ].map((action) => (
                                <button
                                    key={action.value}
                                    type="button"
                                    className={`${styles.actionButton} ${styles[action.tone]} ${
                                        activeModes[layer.id] === action.value ? styles.selected : ""
                                    }`}
                                    disabled={busyLayer === layer.id}
                                    onClick={() => handleLayerCommand(layer.id, action.value)}
                                >
                                    {action.label}
                                </button>
                            ))}
                            <label className={styles.durationField}>
                                <span>Duration (sec, optional)</span>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="e.g. 3600"
                                    value={layer.durationSec}
                                    onChange={(e) =>
                                        updateLayer(layer.id, (prev) => ({
                                            durationSec: e.target.value,
                                            schedule: { ...prev.schedule },
                                        }))
                                    }
                                />
                            </label>
                        </div>

                        <form
                            className={styles.scheduleForm}
                            onSubmit={(event) => handleScheduleSubmit(event, layer.id)}
                        >
                            <label className={styles.field}>
                                <span>Start time</span>
                                <input
                                    type="time"
                                    value={layer.schedule.start}
                                    onChange={(e) =>
                                        updateLayer(layer.id, (prev) => ({
                                            schedule: { ...prev.schedule, start: e.target.value },
                                        }))
                                    }
                                    required
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Duration (hours)</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={layer.schedule.durationHours}
                                    onChange={(e) =>
                                        updateLayer(layer.id, (prev) => ({
                                            schedule: {
                                                ...prev.schedule,
                                                durationHours: e.target.value,
                                            },
                                        }))
                                    }
                                    required
                                />
                            </label>
                            <button type="submit" className={styles.submitButton} disabled={sendingSchedule}>
                                {sendingSchedule ? "Saving..." : "Save schedule"}
                            </button>
                        </form>

                        <div className={styles.meta}>
                            <span>Command topic: actuator/led/cmd</span>
                            <span>Status topic: actuator/led/status/{layer.id}</span>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}

export default ControlPanel;
