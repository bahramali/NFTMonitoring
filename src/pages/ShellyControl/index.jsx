import React, { useEffect, useMemo, useState } from "react";
import {
    createAutomation,
    deleteAutomation,
    fetchAutomations,
    fetchHierarchy,
    fetchStatuses,
    setSocketState,
} from "../../api/shelly";
import styles from "./ShellyControlPage.module.css";

const STATUS_REFRESH_MS = 8000;

function StatusDot({ on }) {
    return <span className={`${styles.statusDot} ${on ? styles.statusOn : styles.statusOff}`} />;
}

function SocketCard({ socket, status, onToggle, onAutomation }) {
    const online = status?.online;
    const isOn = status?.outputOn;

    return (
        <div className={styles.socketCard}>
            <div className={styles.socketHeader}>
                <div>
                    <h4 className={styles.socketTitle}>{socket.name}</h4>
                    <div className={styles.status}>
                        <StatusDot on={!!online} />
                        <span>{online ? "Online" : "Offline"}</span>
                    </div>
                </div>
                <span className={`${styles.badge} ${isOn ? styles.badgeOnline : styles.badgeOffline}`}>
                    {isOn ? "ON" : "OFF"}
                </span>
            </div>
            <div className={styles.metricRow}>
                <span className={styles.metric}>ID: {socket.id}</span>
                {typeof status?.powerW === "number" && <span className={styles.metric}>Power: {status.powerW.toFixed(1)} W</span>}
                {typeof status?.voltageV === "number" && <span className={styles.metric}>Voltage: {status.voltageV.toFixed(1)} V</span>}
            </div>
            <div className={styles.controls}>
                <button className={styles.primaryButton} type="button" onClick={() => onToggle(socket, status)}>
                    {isOn ? "Turn OFF" : "Turn ON"}
                </button>
                <button className={styles.secondaryButton} type="button" onClick={() => onAutomation(socket)}>
                    Automation…
                </button>
            </div>
        </div>
    );
}

function AutomationModal({ socket, onClose, onSubmit }) {
    const [tab, setTab] = useState("TIME_RANGE");
    const [form, setForm] = useState({ startTime: "06:00", endTime: "22:00", intervalMinutes: 15, autoOffMinutes: 5 });

    useEffect(() => {
        setTab("TIME_RANGE");
    }, [socket]);

    const handleChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        const payload = { socketId: socket.id, type: tab };
        if (tab === "TIME_RANGE") {
            payload.startTime = form.startTime;
            payload.endTime = form.endTime;
            payload.daysOfWeek = form.daysOfWeek?.split(",").map((d) => d.trim().toUpperCase()).filter(Boolean);
        }
        if (tab === "INTERVAL_TOGGLE") {
            payload.intervalMinutes = Number(form.intervalMinutes);
        }
        if (tab === "AUTO_OFF") {
            payload.autoOffMinutes = Number(form.autoOffMinutes);
        }
        onSubmit(payload);
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <div>
                        <h3 className={styles.title}>Automation for {socket.name}</h3>
                        <p className={styles.helper}>Configure time windows, interval toggles, or auto-off timers.</p>
                    </div>
                    <button className={styles.secondaryButton} type="button" onClick={onClose}>
                        Close
                    </button>
                </div>
                <div className={styles.tabRow}>
                    {[
                        { id: "TIME_RANGE", label: "Time Range" },
                        { id: "INTERVAL_TOGGLE", label: "Interval" },
                        { id: "AUTO_OFF", label: "Auto-off" },
                    ].map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`${styles.tabButton} ${tab === item.id ? styles.tabActive : ""}`}
                            onClick={() => setTab(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {tab === "TIME_RANGE" && (
                    <>
                        <div className={styles.field}>
                            <label htmlFor="start">Start time</label>
                            <input
                                id="start"
                                className={styles.input}
                                type="time"
                                value={form.startTime}
                                onChange={(e) => handleChange("startTime", e.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="end">End time</label>
                            <input
                                id="end"
                                className={styles.input}
                                type="time"
                                value={form.endTime}
                                onChange={(e) => handleChange("endTime", e.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="days">Days (optional, comma separated MON,TUE…)</label>
                            <input
                                id="days"
                                className={styles.textInput}
                                placeholder="Leave empty for every day"
                                value={form.daysOfWeek || ""}
                                onChange={(e) => handleChange("daysOfWeek", e.target.value)}
                            />
                        </div>
                    </>
                )}

                {tab === "INTERVAL_TOGGLE" && (
                    <div className={styles.field}>
                        <label htmlFor="interval">Interval minutes</label>
                        <input
                            id="interval"
                            className={styles.input}
                            type="number"
                            min="1"
                            value={form.intervalMinutes}
                            onChange={(e) => handleChange("intervalMinutes", e.target.value)}
                        />
                        <span className={styles.helper}>Socket will toggle every N minutes.</span>
                    </div>
                )}

                {tab === "AUTO_OFF" && (
                    <div className={styles.field}>
                        <label htmlFor="autoOff">Turn off after (minutes)</label>
                        <input
                            id="autoOff"
                            className={styles.input}
                            type="number"
                            min="1"
                            value={form.autoOffMinutes}
                            onChange={(e) => handleChange("autoOffMinutes", e.target.value)}
                        />
                        <span className={styles.helper}>Turns on immediately and powers down after the duration.</span>
                    </div>
                )}

                <div className={styles.modalActions}>
                    <button className={styles.secondaryButton} type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className={styles.primaryButton} type="button" onClick={handleSubmit}>
                        Save automation
                    </button>
                </div>
            </div>
        </div>
    );
}

function AutomationList({ automations, onDelete }) {
    if (!automations.length) return <p className={styles.helper}>No automations configured yet.</p>;
    return (
        <div className={styles.automationList}>
            {automations.map((a) => (
                <div key={a.id} className={styles.automationRow}>
                    <div className={styles.automationDetails}>
                        <span className={styles.automationLabel}>{a.type.replace("_", " ")} — {a.socketId}</span>
                        {a.type === "TIME_RANGE" && (
                            <span className={styles.helper}>
                                {a.startTime} → {a.endTime} {a.daysOfWeek?.length ? `(${a.daysOfWeek.join(",")})` : "(daily)"}
                            </span>
                        )}
                        {a.type === "INTERVAL_TOGGLE" && (
                            <span className={styles.helper}>Toggle every {a.intervalMinutes} minutes</span>
                        )}
                        {a.type === "AUTO_OFF" && (
                            <span className={styles.helper}>Turn off after {a.autoOffMinutes} minutes</span>
                        )}
                    </div>
                    <button className={styles.dangerButton} type="button" onClick={() => onDelete(a.id)}>
                        Delete
                    </button>
                </div>
            ))}
        </div>
    );
}

export default function ShellyControlPage() {
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState();
    const [statuses, setStatuses] = useState({});
    const [automations, setAutomations] = useState([]);
    const [modalSocket, setModalSocket] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchHierarchy()
            .then((data) => {
                const loadedRooms = data?.rooms || [];
                setRooms(loadedRooms);
                if (!selectedRoom && loadedRooms.length) setSelectedRoom(loadedRooms[0].id);
            })
            .catch((err) => setError(err.message));
        fetchAutomations()
            .then(setAutomations)
            .catch((err) => setError(err.message));
    }, []);

    const sockets = useMemo(() => {
        const room = rooms.find((r) => r.id === selectedRoom);
        return room?.racks?.flatMap((rack) => rack.sockets.map((socket) => ({ ...socket, rackName: rack.name }))) || [];
    }, [rooms, selectedRoom]);

    const refreshStatuses = () => {
        fetchStatuses(sockets.map((s) => s.id))
            .then((data) => setStatuses(data || {}))
            .catch((err) => setError(err.message));
    };

    useEffect(() => {
        if (!sockets.length) return undefined;
        refreshStatuses();
        const timer = setInterval(refreshStatuses, STATUS_REFRESH_MS);
        return () => clearInterval(timer);
    }, [selectedRoom, sockets.length]);

    const handleToggle = (socket, status) => {
        const target = !(status?.outputOn);
        setStatuses((prev) => ({ ...prev, [socket.id]: { ...status, outputOn: target } }));
        setSocketState(socket.id, target)
            .then((resp) => setStatuses((prev) => ({ ...prev, [socket.id]: resp })))
            .catch((err) => setError(err.message));
    };

    const handleAutomationSubmit = (payload) => {
        createAutomation(payload)
            .then((automation) => {
                setAutomations((prev) => [...prev.filter((a) => a.id !== automation.id), automation]);
                setModalSocket(null);
            })
            .catch((err) => setError(err.message));
    };

    const handleDeleteAutomation = (id) => {
        deleteAutomation(id)
            .then(() => setAutomations((prev) => prev.filter((a) => a.id !== id)))
            .catch((err) => setError(err.message));
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h2 className={styles.title}>Shelly Control</h2>
                <div className={styles.roomSelector}>
                    <span>Room</span>
                    <select
                        className={styles.roomSelect}
                        value={selectedRoom || ""}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                    >
                        {rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                                {room.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {error && <div className={styles.helper} style={{ color: "#b91c1c" }}>{error}</div>}

            <div className={styles.racksGrid}>
                {rooms
                    .find((room) => room.id === selectedRoom)?.racks?.map((rack) => (
                        <div key={rack.id} className={styles.rackCard}>
                            <div className={styles.rackHeader}>
                                <h3 className={styles.rackTitle}>{rack.name}</h3>
                                <span className={styles.helper}>Rack ID: {rack.id}</span>
                            </div>
                            <div className={styles.socketsGrid}>
                                {rack.sockets.map((socket) => (
                                    <SocketCard
                                        key={socket.id}
                                        socket={socket}
                                        status={statuses?.[socket.id]}
                                        onToggle={handleToggle}
                                        onAutomation={() => setModalSocket(socket)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
            </div>

            <div className={styles.automationSection}>
                <h3 className={styles.rackTitle}>Automations</h3>
                <AutomationList automations={automations} onDelete={handleDeleteAutomation} />
            </div>

            {modalSocket && (
                <AutomationModal
                    socket={modalSocket}
                    onClose={() => setModalSocket(null)}
                    onSubmit={handleAutomationSubmit}
                />
            )}
        </div>
    );
}
