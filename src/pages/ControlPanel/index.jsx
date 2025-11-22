import React, { useMemo, useState } from "react";
import { sendLedCommand } from "../../api/actuators";
import Header from "../common/Header";
import styles from "./ControlPanel.module.css";

const minutesAgo = (mins) => new Date(Date.now() - mins * 60 * 1000);

const initialZones = [
    {
        id: "grow-room-a",
        name: "Grow Room A",
        fixtures: 6,
        schedule: "06:00 – 22:00",
        isOn: true,
        intensity: 82,
        spectrum: "Full spectrum 3500K",
        lastUpdated: minutesAgo(12),
    },
    {
        id: "grow-room-b",
        name: "Grow Room B",
        fixtures: 5,
        schedule: "06:30 – 22:30",
        isOn: true,
        intensity: 76,
        spectrum: "Cool-white emphasis",
        lastUpdated: minutesAgo(5),
    },
    {
        id: "flowering-bay",
        name: "Flowering Bay",
        fixtures: 4,
        schedule: "08:00 – 23:00",
        isOn: true,
        intensity: 91,
        spectrum: "Warm bloom boost",
        lastUpdated: minutesAgo(18),
    },
    {
        id: "propagation",
        name: "Propagation Lab",
        fixtures: 3,
        schedule: "05:30 – 21:00",
        isOn: false,
        intensity: 24,
        spectrum: "Low-output rooting",
        lastUpdated: minutesAgo(34),
    },
    {
        id: "support",
        name: "Support Corridor",
        fixtures: 2,
        schedule: "Auto on motion",
        isOn: false,
        intensity: 0,
        spectrum: "Utility warm",
        lastUpdated: minutesAgo(47),
    },
];

const initialActivity = [
    { id: "act-1", message: "Propagation Lab dimmed to 20% for cuttings.", timestamp: minutesAgo(7) },
    { id: "act-2", message: "Scene \"Vegetative Boost\" applied across grow rooms.", timestamp: minutesAgo(28) },
    { id: "act-3", message: "Support Corridor turned off after inspection.", timestamp: minutesAgo(52) },
];

const scenes = [
    {
        id: "veg",
        name: "Vegetative Boost",
        description: "Cool spectrum with moderate output for leafy growth.",
        intensity: 70,
        spectrum: "Cool-white emphasis",
    },
    {
        id: "flower",
        name: "Flowering Bloom",
        description: "High-output warm spectrum for fruit and bloom stages.",
        intensity: 90,
        spectrum: "Warm bloom boost",
    },
    {
        id: "night",
        name: "Night Cycle",
        description: "All fixtures off except minimum safety lighting.",
        intensity: 0,
        spectrum: "Safety amber",
    },
];

const formatRelativeTime = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    const diff = Date.now() - date.getTime();

    if (Number.isNaN(diff)) {
        return "Unknown";
    }

    const thresholds = [
        { limit: 60 * 1000, divisor: 1000, unit: "second" },
        { limit: 60 * 60 * 1000, divisor: 60 * 1000, unit: "minute" },
        { limit: 24 * 60 * 60 * 1000, divisor: 60 * 60 * 1000, unit: "hour" },
    ];

    for (const { limit, divisor, unit } of thresholds) {
        if (diff < limit) {
            const value = Math.max(1, Math.round(diff / divisor));
            return `${value} ${unit}${value > 1 ? "s" : ""} ago`;
        }
    }

    const days = Math.max(1, Math.round(diff / (24 * 60 * 60 * 1000)));
    return `${days} day${days > 1 ? "s" : ""} ago`;
};

function ControlPanel() {
    const [zones, setZones] = useState(initialZones);
    const [activity, setActivity] = useState(initialActivity);
    const [activeScene, setActiveScene] = useState("custom");
    const [ledCommand, setLedCommand] = useState({
        system: "S01",
        layer: "L01",
        deviceId: "R01",
        controller: "white",
        command: "AUTO",
        durationSec: "",
    });
    const [sendingCommand, setSendingCommand] = useState(false);
    const [commandState, setCommandState] = useState({ status: "idle", message: "" });

    const poweredZones = useMemo(() => zones.filter((zone) => zone.isOn), [zones]);
    const fixturesTotal = useMemo(() => zones.reduce((sum, zone) => sum + zone.fixtures, 0), [zones]);
    const activeFixtures = useMemo(
        () => poweredZones.reduce((sum, zone) => sum + zone.fixtures, 0),
        [poweredZones]
    );
    const averageIntensity = useMemo(() => {
        if (!zones.length) return 0;
        const total = zones.reduce((sum, zone) => sum + zone.intensity, 0);
        return Math.round(total / zones.length);
    }, [zones]);

    const logAction = (message) => {
        setActivity((prev) => [
            { id: `act-${Date.now()}`, message, timestamp: new Date() },
            ...prev,
        ].slice(0, 8));
    };

    const buildLedPayload = (commandOverride, { forceDuration } = {}) => {
        const normalizedCommand = (commandOverride ?? ledCommand.command ?? "AUTO").toUpperCase();
        const safeCommand = ["ON", "OFF", "AUTO"].includes(normalizedCommand)
            ? normalizedCommand
            : "AUTO";
        const payload = {
            system: ledCommand.system.trim() || "S01",
            layer: (ledCommand.layer || "L01").trim().toUpperCase(),
            deviceId: ledCommand.deviceId.trim() || "R01",
            controller: (ledCommand.controller || "white").trim().toLowerCase(),
            command: safeCommand,
        };

        if (payload.command !== "AUTO") {
            const parsedDuration = Number.parseInt(ledCommand.durationSec, 10);
            if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
                payload.durationSec = parsedDuration;
            } else if (forceDuration) {
                payload.durationSec = 1800;
            }
        }

        return payload;
    };

    const commandPreview = useMemo(() => buildLedPayload(), [ledCommand]);

    const handleSendCommand = async ({ commandOverride, forceDuration } = {}) => {
        const payload = buildLedPayload(commandOverride, { forceDuration });
        setSendingCommand(true);
        setCommandState({ status: "pending", message: "Sending command..." });

        try {
            const response = await sendLedCommand(payload);
            setCommandState({ status: "success", message: response?.message ?? "Command accepted", payload });
            logAction(
                `LED ${payload.command}${payload.durationSec ? ` (${payload.durationSec}s)` : ""} sent to ${payload.deviceId} • ${payload.layer}/${payload.controller}.`
            );
        } catch (error) {
            setCommandState({ status: "error", message: error?.message ?? "Failed to send command" });
        } finally {
            setSendingCommand(false);
        }
    };

    const toggleZone = (id) => {
        let note = "";
        setZones((prev) =>
            prev.map((zone) => {
                if (zone.id !== id) return zone;
                const isOn = !zone.isOn;
                note = `${zone.name} turned ${isOn ? "on" : "off"}.`;
                return { ...zone, isOn, intensity: isOn ? Math.max(zone.intensity, 20) : 0, lastUpdated: new Date() };
            })
        );
        if (note) {
            setActiveScene("custom");
            logAction(note);
        }
    };

    const adjustIntensity = (id, delta) => {
        let note = "";
        setZones((prev) =>
            prev.map((zone) => {
                if (zone.id !== id) return zone;
                const nextIntensity = Math.max(0, Math.min(100, zone.intensity + delta));
                if (nextIntensity === zone.intensity) return zone;
                note = `${zone.name} intensity set to ${nextIntensity}%`;
                return {
                    ...zone,
                    intensity: nextIntensity,
                    isOn: nextIntensity > 0,
                    lastUpdated: new Date(),
                };
            })
        );
        if (note) {
            setActiveScene("custom");
            logAction(note);
        }
    };

    const setAllZones = (state) => {
        const note = state ? "All lighting zones turned on." : "All lighting zones turned off.";
        setZones((prev) =>
            prev.map((zone) => ({
                ...zone,
                isOn: state,
                intensity: state ? Math.max(zone.intensity, 60) : 0,
                lastUpdated: new Date(),
            }))
        );
        setActiveScene("custom");
        logAction(note);
    };

    const applyScene = (scene) => {
        setZones((prev) =>
            prev.map((zone) => ({
                ...zone,
                isOn: scene.intensity > 0,
                intensity: scene.intensity,
                spectrum: scene.spectrum,
                lastUpdated: new Date(),
            }))
        );
        setActiveScene(scene.id);
        logAction(`Scene "${scene.name}" applied.`);
    };

    const activeSceneName = useMemo(() => {
        if (activeScene === "custom") return "Custom";
        const match = scenes.find((scene) => scene.id === activeScene);
        return match ? match.name : "Custom";
    }, [activeScene]);

    return (
        <div className={styles.page}>
            <Header title="Control Panel" />

            <section className={styles.commandPanel}>
                <div className={styles.commandHeader}>
                    <div>
                        <p className={styles.commandEyebrow}>LED actuator via MQTT</p>
                        <h2 className={styles.commandTitle}>Send LED commands</h2>
                        <p className={styles.commandDescription}>
                            Dispatch ON / OFF / AUTO requests to <code>actuator/led/cmd</code> using the exact JSON structure expected
                            by the ESP (<code>system</code>, <code>layer</code>, <code>deviceId</code>, <code>controller</code>,
                            <code>command</code>, optional <code>durationSec</code>). Manual commands with <code>durationSec</code> revert
                            to AUTO automatically.
                        </p>
                    </div>
                    <div className={styles.topicBadge}>Topic: actuator/led/cmd</div>
                </div>

                <div className={styles.commandGrid}>
                    <div className={styles.commandForm}>
                        <div className={styles.fieldRow}>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>System</span>
                                <input
                                    type="text"
                                    value={ledCommand.system}
                                    className={styles.input}
                                    onChange={(e) => setLedCommand((prev) => ({ ...prev, system: e.target.value }))}
                                />
                            </label>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Layer</span>
                                <select
                                    className={styles.input}
                                    value={ledCommand.layer}
                                    onChange={(e) => setLedCommand((prev) => ({ ...prev, layer: e.target.value }))}
                                >
                                    <option value="L01">L01 (Layer 1)</option>
                                    <option value="L02">L02 (Layer 2)</option>
                                </select>
                            </label>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Device ID</span>
                                <input
                                    type="text"
                                    value={ledCommand.deviceId}
                                    className={styles.input}
                                    onChange={(e) => setLedCommand((prev) => ({ ...prev, deviceId: e.target.value }))}
                                />
                            </label>
                        </div>

                        <div className={styles.fieldRow}>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Controller</span>
                                <select
                                    className={styles.input}
                                    value={ledCommand.controller}
                                    onChange={(e) => setLedCommand((prev) => ({ ...prev, controller: e.target.value }))}
                                >
                                    <option value="white">white (per layer)</option>
                                    <option value="bloom">bloom (per layer)</option>
                                </select>
                            </label>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Command</span>
                                <select
                                    className={styles.input}
                                    value={ledCommand.command}
                                    onChange={(e) => setLedCommand((prev) => ({ ...prev, command: e.target.value }))}
                                >
                                    <option value="AUTO">AUTO</option>
                                    <option value="ON">ON</option>
                                    <option value="OFF">OFF</option>
                                </select>
                            </label>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>Duration (sec)</span>
                                <input
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    className={styles.input}
                                    value={ledCommand.durationSec}
                                    onChange={(e) => setLedCommand((prev) => ({ ...prev, durationSec: e.target.value }))}
                                />
                                <span className={styles.fieldHint}>Optional for ON/OFF manual overrides (seconds)</span>
                            </label>
                        </div>

                        <button
                            type="button"
                            className={`${styles.actionButton} ${styles.actionPrimary} ${styles.commandSubmit}`}
                            onClick={() => handleSendCommand({ commandOverride: ledCommand.command })}
                            disabled={sendingCommand}
                        >
                            {sendingCommand ? "Sending..." : "Send selected command"}
                        </button>
                    </div>

                    <div className={styles.commandActions}>
                        <div className={styles.quickActionsHeader}>Quick actions</div>
                        <div className={styles.quickActionButtons}>
                            <button
                                type="button"
                                className={`${styles.pillButton} ${styles.pillSecondary}`}
                                onClick={() => handleSendCommand({ commandOverride: "OFF" })}
                                disabled={sendingCommand}
                            >
                                Manual OFF
                            </button>
                            <button
                                type="button"
                                className={`${styles.pillButton} ${styles.pillPrimary}`}
                                onClick={() => handleSendCommand({ commandOverride: "ON" })}
                                disabled={sendingCommand}
                            >
                                Manual ON
                            </button>
                            <button
                                type="button"
                                className={`${styles.pillButton} ${styles.pillPrimary}`}
                                onClick={() => handleSendCommand({ commandOverride: "ON", forceDuration: true })}
                                disabled={sendingCommand}
                            >
                                Timed ON (defaults 1800s then AUTO)
                            </button>
                            <button
                                type="button"
                                className={`${styles.pillButton} ${styles.pillSecondary}`}
                                onClick={() => handleSendCommand({ commandOverride: "AUTO" })}
                                disabled={sendingCommand}
                            >
                                Return to AUTO
                            </button>
                        </div>

                        <div
                            className={`${styles.statusBox} ${
                                commandState.status === "success"
                                    ? styles.statusSuccess
                                    : commandState.status === "error"
                                    ? styles.statusError
                                    : ""
                            }`}
                        >
                            <div className={styles.statusLabel}>Status</div>
                            <div className={styles.statusMessage}>
                                {commandState.status === "idle" && "Awaiting command"}
                                {commandState.status === "pending" && "Sending to MQTT bridge..."}
                                {commandState.status === "success" && commandState.message}
                                {commandState.status === "error" && commandState.message}
                            </div>
                            {commandState?.payload && (
                                <div className={styles.statusMeta}>
                                    {commandState.payload.command}
                                    {commandState.payload.durationSec ? ` • ${commandState.payload.durationSec}s` : ""}
                                    {` • ${commandState.payload.layer} / ${commandState.payload.controller}`}
                                    {` → ${commandState.payload.deviceId}`}
                                </div>
                            )}
                        </div>

                        <div className={styles.previewBox}>
                            <div className={styles.statusLabel}>Payload preview</div>
                            <pre className={styles.previewContent}>{JSON.stringify(commandPreview, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.summary}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Lights On</div>
                    <div className={styles.summaryValue}>
                        {poweredZones.length}
                        <span className={styles.summaryTotal}> / {zones.length}</span>
                    </div>
                    <div className={styles.summaryMeta}>
                        {activeFixtures} of {fixturesTotal} fixtures active
                    </div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Average Intensity</div>
                    <div className={styles.summaryValue}>{averageIntensity}%</div>
                    <div className={styles.summaryMeta}>Across all lighting zones</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Scene</div>
                    <div className={styles.summaryValue}>{activeSceneName}</div>
                    <div className={styles.summaryMeta}>Quick profiles for your crops</div>
                </div>
            </section>

            <section className={styles.quickActions}>
                <div className={styles.actionButtons}>
                    <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionPrimary}`}
                        onClick={() => setAllZones(true)}
                    >
                        <span>Turn all on</span>
                    </button>
                    <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionDanger}`}
                        onClick={() => setAllZones(false)}
                    >
                        <span>Turn all off</span>
                    </button>
                </div>

                <div className={styles.sceneList}>
                    {scenes.map((scene) => (
                        <button
                            key={scene.id}
                            type="button"
                            className={`${styles.sceneButton} ${
                                activeScene === scene.id ? styles.sceneButtonActive : ""
                            }`}
                            onClick={() => applyScene(scene)}
                        >
                            <span className={styles.sceneName}>{scene.name}</span>
                            <span className={styles.sceneMeta}>{scene.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className={styles.grid}>
                {zones.map((zone) => (
                    <article key={zone.id} className={styles.card}>
                        <header className={styles.cardHeader}>
                            <div>
                                <h2 className={styles.cardTitle}>{zone.name}</h2>
                                <div className={styles.cardSubtitle}>
                                    {zone.fixtures} {zone.fixtures === 1 ? "fixture" : "fixtures"} • {zone.schedule}
                                </div>
                            </div>
                            <span
                                className={`${styles.status} ${zone.isOn ? styles.statusOn : styles.statusOff}`}
                            >
                                {zone.isOn ? "On" : "Off"}
                            </span>
                        </header>

                        <dl className={styles.metrics}>
                            <div className={styles.metricRow}>
                                <dt>Intensity</dt>
                                <dd>{zone.intensity}%</dd>
                            </div>
                            <div className={styles.meter}>
                                <div
                                    className={styles.meterFill}
                                    style={{ width: `${zone.intensity}%` }}
                                />
                            </div>
                            <div className={styles.metricRow}>
                                <dt>Spectrum</dt>
                                <dd>{zone.spectrum}</dd>
                            </div>
                            <div className={styles.metricRow}>
                                <dt>Last update</dt>
                                <dd>{formatRelativeTime(zone.lastUpdated)}</dd>
                            </div>
                        </dl>

                        <div className={styles.cardActions}>
                            <button
                                type="button"
                                className={`${styles.pillButton} ${zone.isOn ? styles.pillSecondary : styles.pillPrimary}`}
                                onClick={() => toggleZone(zone.id)}
                            >
                                {zone.isOn ? "Turn off" : "Turn on"}
                            </button>
                            <button
                                type="button"
                                className={`${styles.pillButton} ${styles.pillPrimary}`}
                                onClick={() => adjustIntensity(zone.id, 10)}
                            >
                                +10%
                            </button>
                            <button
                                type="button"
                                className={`${styles.pillButton} ${styles.pillSecondary}`}
                                onClick={() => adjustIntensity(zone.id, -10)}
                            >
                                -10%
                            </button>
                        </div>
                    </article>
                ))}
            </section>

            <section className={styles.activity}>
                <h2 className={styles.activityTitle}>Recent activity</h2>
                {activity.length === 0 ? (
                    <div className={styles.empty}>No lighting changes logged yet.</div>
                ) : (
                    <ul className={styles.activityList}>
                        {activity.map((item) => (
                            <li key={item.id} className={styles.activityItem}>
                                <span>{item.message}</span>
                                <span className={styles.activityTime}>{formatRelativeTime(item.timestamp)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

export default ControlPanel;
