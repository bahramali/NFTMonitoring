import React, { useMemo, useState } from "react";
import { sendLedCommand } from "../../api/actuators";
import Header from "../common/Header";
import styles from "./ControlPanel.module.css";

const layerPresets = [
    { id: "L01", name: "Grow Room A" },
    { id: "L02", name: "Grow Room B" },
    { id: "L03", name: "Grow Room C" },
    { id: "L04", name: "Grow Room D" },
];

const defaultSchedule = { start: "06:00", stop: "22:00" };

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

function ControlPanel() {
    const [layers, setLayers] = useState(
        layerPresets.map((layer) => ({ ...layer, mode: "AUTO", updatedAt: null }))
    );
    const [schedule, setSchedule] = useState(defaultSchedule);
    const [busyLayer, setBusyLayer] = useState(null);
    const [sendingSchedule, setSendingSchedule] = useState(false);
    const [feedback, setFeedback] = useState({ status: "idle", message: "" });

    const activeModes = useMemo(
        () => layers.reduce((map, layer) => ({ ...map, [layer.id]: layer.mode }), {}),
        [layers]
    );

    const updateLayerMode = (layerId, mode) => {
        setLayers((prev) =>
            prev.map((layer) =>
                layer.id === layerId ? { ...layer, mode, updatedAt: new Date() } : layer
            )
        );
    };

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
            const response = await sendLedCommand(payload);
            setFeedback({
                status: "success",
                message: response?.message ?? `${command} command sent for ${layerId}`,
            });
            updateLayerMode(layerId, command);
        } catch (error) {
            setFeedback({
                status: "error",
                message: error?.message ?? "Command could not be sent",
            });
        } finally {
            setBusyLayer(null);
        }
    };

    const handleScheduleSubmit = async (event) => {
        event.preventDefault();

        const start = parseTime(schedule.start);
        const stop = parseTime(schedule.stop);

        if (!start || !stop) {
            setFeedback({ status: "error", message: "Enter valid start and stop times." });
            return;
        }

        const startMinutes = start.hours * 60 + start.minutes;
        const stopMinutes = stop.hours * 60 + stop.minutes;
        const durationMinutes = stopMinutes >= startMinutes
            ? stopMinutes - startMinutes
            : 24 * 60 - (startMinutes - stopMinutes);
        const durationHours = Math.max(1, Math.round(durationMinutes / 60));

        setSendingSchedule(true);
        setFeedback({ status: "pending", message: "Sending lighting schedule..." });

        try {
            const payload = {
                system: "S01",
                deviceId: "R01",
                command: "SET_SCHEDULE",
                onHour: start.hours,
                onMinute: start.minutes,
                durationHours,
            };
            const response = await sendLedCommand(payload);
            setFeedback({
                status: "success",
                message: response?.message ?? "Lighting schedule saved.",
            });
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
                        Choose ON, OFF, or AUTO for each layer. Set start and stop times in the scheduling card to
                        automate the relays.
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
                                {layer.mode === "AUTO" ? "Auto" : layer.mode === "ON" ? "On" : "Off"}
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
                        </div>

                        <div className={styles.meta}>
                            <span>Last change: {formatTimestamp(layer.updatedAt)}</span>
                        </div>
                    </article>
                ))}
            </section>

            <section className={styles.scheduleCard}>
                <div>
                    <h2 className={styles.scheduleTitle}>Lighting Schedule</h2>
                    <p className={styles.scheduleText}>
                        Enter start and stop times for the relays to run automatically.
                    </p>
                </div>
                <form className={styles.scheduleForm} onSubmit={handleScheduleSubmit}>
                    <label className={styles.field}>
                        <span>Start time</span>
                        <input
                            type="time"
                            value={schedule.start}
                            onChange={(e) => setSchedule((prev) => ({ ...prev, start: e.target.value }))}
                            required
                        />
                    </label>
                    <label className={styles.field}>
                        <span>Stop time</span>
                        <input
                            type="time"
                            value={schedule.stop}
                            onChange={(e) => setSchedule((prev) => ({ ...prev, stop: e.target.value }))}
                            required
                        />
                    </label>
                    <button type="submit" className={styles.submitButton} disabled={sendingSchedule}>
                        {sendingSchedule ? "Saving..." : "Save schedule"}
                    </button>
                </form>
            </section>
        </div>
    );
}

export default ControlPanel;
