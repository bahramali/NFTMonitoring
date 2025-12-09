import React, { useEffect, useMemo, useState } from "react";
import {
    fetchShellyDeviceStatus,
    fetchShellyDevices,
    scheduleShellyDevice,
    toggleShellyDevice,
    turnShellyOff,
    turnShellyOn,
} from "../../api/shelly";
import Header from "../common/Header";
import styles from "./ControlPanel.module.css";

const defaultSchedule = { turnOnAt: "", turnOffAt: "", durationMinutes: "" };

const normalizeStatus = (payload) => {
    const candidates = [
        payload?.status,
        payload?.state,
        payload?.isOn,
        payload?.on,
        payload?.value,
        payload,
    ];

    const found = candidates.find((candidate) => typeof candidate !== "undefined" && candidate !== null);

    if (typeof found === "string") {
        return found.toUpperCase();
    }

    if (typeof found === "boolean") {
        return found ? "ON" : "OFF";
    }

    if (Number.isFinite(Number(found))) {
        return Number(found) > 0 ? "ON" : "OFF";
    }

    return "UNKNOWN";
};

const formatDateTime = (value) => {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
};

const formatDateTimeForPayload = (value) => {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    const pad = (unit) => String(unit).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
        date.getMinutes()
    )}:${pad(date.getSeconds())}`;
};

function ControlPanel() {
    const [devices, setDevices] = useState([]);
    const [feedback, setFeedback] = useState({ status: "idle", message: "" });
    const [busyDevice, setBusyDevice] = useState(null);
    const [schedulingDevice, setSchedulingDevice] = useState(null);
    const [loadingDevices, setLoadingDevices] = useState(false);

    const activeStatuses = useMemo(
        () => devices.reduce((map, device) => ({ ...map, [device.id]: normalizeStatus(device.status) }), {}),
        [devices]
    );

    const updateDevice = (deviceId, updater) => {
        setDevices((prev) => prev.map((device) => (device.id === deviceId ? { ...device, ...updater(device) } : device)));
    };

    const refreshDeviceStatus = async (deviceId) => {
        try {
            const response = await fetchShellyDeviceStatus(deviceId);
            const status = normalizeStatus(response);
            updateDevice(deviceId, () => ({ status, updatedAt: new Date(response?.timestamp ?? Date.now()) }));
        } catch (error) {
            console.error(`Could not refresh status for ${deviceId}`, error);
            setFeedback({ status: "error", message: error?.message ?? `Could not refresh ${deviceId}` });
        }
    };

    const loadDevices = async () => {
        setLoadingDevices(true);
        setFeedback({ status: "pending", message: "در حال دریافت لیست دستگاه‌های Shelly..." });

        try {
            const list = await fetchShellyDevices();
            const parsed = Array.isArray(list)
                ? list
                : Array.isArray(list?.devices)
                    ? list.devices
                    : [];

            const hydrated = parsed.map((device) => ({
                id: device.id ?? device.deviceId ?? device.name,
                name: device.name ?? device.label ?? device.id ?? device.deviceId ?? "Unnamed device",
                status: normalizeStatus(device.status ?? device.state),
                updatedAt: device.updatedAt ? new Date(device.updatedAt) : null,
                schedule: { ...defaultSchedule },
            }));

            setDevices(hydrated);
            setFeedback({ status: "success", message: "لیست دستگاه‌ها آماده است." });

            await Promise.all(hydrated.map((device) => refreshDeviceStatus(device.id)));
            setFeedback({ status: "idle", message: "" });
        } catch (error) {
            setFeedback({ status: "error", message: error?.message ?? "دستگاه‌ها بارگذاری نشدند" });
        } finally {
            setLoadingDevices(false);
        }
    };

    useEffect(() => {
        loadDevices();
    }, []);

    const handleCommand = async (deviceId, command) => {
        setBusyDevice(deviceId);
        setFeedback({ status: "pending", message: `${command} در حال ارسال است...` });

        try {
            if (command === "ON") await turnShellyOn(deviceId);
            else if (command === "OFF") await turnShellyOff(deviceId);
            else if (command === "TOGGLE") await toggleShellyDevice(deviceId);

            setFeedback({ status: "success", message: `${deviceId} به حالت ${command} رفت.` });
            await refreshDeviceStatus(deviceId);
        } catch (error) {
            setFeedback({ status: "error", message: error?.message ?? "دستور ارسال نشد." });
        } finally {
            setBusyDevice(null);
        }
    };

    const handleScheduleSubmit = async (event, deviceId) => {
        event.preventDefault();
        const device = devices.find((item) => item.id === deviceId);
        const payload = {};

        if (device?.schedule?.turnOnAt) payload.turnOnAt = formatDateTimeForPayload(device.schedule.turnOnAt);
        if (device?.schedule?.turnOffAt) payload.turnOffAt = formatDateTimeForPayload(device.schedule.turnOffAt);
        if (device?.schedule?.durationMinutes)
            payload.durationMinutes = Number.parseInt(device.schedule.durationMinutes, 10);

        if (!payload.turnOnAt && !payload.turnOffAt && !payload.durationMinutes) {
            setFeedback({ status: "error", message: "حداقل یکی از زمان‌ها یا مدت را وارد کنید." });
            return;
        }

        setSchedulingDevice(deviceId);
        setFeedback({ status: "pending", message: `${deviceId} در حال ثبت برنامه است...` });

        try {
            await scheduleShellyDevice(deviceId, payload);
            setFeedback({ status: "success", message: `زمان‌بندی ${deviceId} ثبت شد.` });
        } catch (error) {
            setFeedback({ status: "error", message: error?.message ?? "برنامه ذخیره نشد." });
        } finally {
            setSchedulingDevice(null);
        }
    };

    return (
        <div className={styles.page}>
            <Header title="Control Panel" />

            <section className={styles.hero}>
                <div>
                    <h1 className={styles.title}>Shelly Lighting Control</h1>
                    <p className={styles.subtitle}>
                        همه رله‌ها و لایه‌ها در این صفحه قابل مشاهده است. هر کارت یک دستگاه Shelly است که با
                        شناسه ثبت‌شده (مثل PS01L02) شناخته می‌شود. برای هر دستگاه می‌توانید وضعیت را بخوانید،
                        روشن/خاموش کنید یا زمان‌بندی روی/خاموش شدن را بفرستید.
                    </p>
                    <p className={styles.subtitleSmall}>
                        Endpoints: GET/POST زیر مسیر <code>/api/shelly</code> برای وضعیت، on/off، toggle و schedule استفاده
                        می‌شوند.
                    </p>
                </div>
                <div className={`${styles.feedback} ${styles[feedback.status] || ""}`}>
                    <span className={styles.feedbackLabel}>وضعیت</span>
                    <p className={styles.feedbackMessage}>
                        {feedback.status === "idle" && "آماده دریافت دستور جدید"}
                        {feedback.status === "pending" && feedback.message}
                        {feedback.status === "success" && feedback.message}
                        {feedback.status === "error" && feedback.message}
                    </p>
                </div>
            </section>

            <section className={styles.sectionHeader}>
                <div>
                    <h2 className={styles.sectionTitle}>کنترل سریع لایه‌ها</h2>
                    <p className={styles.sectionHint}>
                        روی صفحه هر لایه کلیک کنید تا به سرعت روشن/خاموش شود؛ برای دقت بیشتر از دکمه‌های پایین استفاده کنید.
                    </p>
                </div>
                <button type="button" className={styles.refreshButton} onClick={loadDevices} disabled={loadingDevices}>
                    {loadingDevices ? "در حال به‌روزرسانی..." : "بازخوانی دستگاه‌ها"}
                </button>
            </section>

            <section className={styles.layerGrid}>
                {devices.map((device) => (
                    <article key={device.id} className={styles.layerCard}>
                        <div className={styles.layerHeader}>
                            <div>
                                <div className={styles.layerName}>{device.name}</div>
                                <div className={styles.layerId}>{device.id}</div>
                            </div>
                            <div
                                className={`${styles.modeBadge} ${styles[activeStatuses[device.id]?.toLowerCase?.() || "unknown"]}`}
                            >
                                <span className={styles.modeBadgeLabel}>{activeStatuses[device.id] || "Unknown"}</span>
                                <span className={styles.modeBadgeMeta}>آخرین بروزرسانی {formatDateTime(device.updatedAt)}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className={`${styles.layerPlate} ${activeStatuses[device.id] === "ON" ? styles.plateOn : ""}`}
                            onClick={() => handleCommand(device.id, "TOGGLE")}
                            disabled={busyDevice === device.id}
                        >
                            <span className={styles.layerPlateLabel}>برای تغییر وضعیت کلیک کنید</span>
                            <span className={styles.layerPlateState}>{activeStatuses[device.id] || "UNKNOWN"}</span>
                        </button>

                        <div className={styles.actions}>
                            {[{ label: "خاموش", value: "OFF", tone: "ghost" }, { label: "روشن", value: "ON", tone: "primary" }].map(
                                (action) => (
                                    <button
                                        key={action.value}
                                        type="button"
                                        className={`${styles.actionButton} ${styles[action.tone]} ${
                                            activeStatuses[device.id] === action.value ? styles.selected : ""
                                        }`}
                                        disabled={busyDevice === device.id}
                                        onClick={() => handleCommand(device.id, action.value)}
                                    >
                                        {action.label}
                                    </button>
                                )
                            )}
                            <button
                                type="button"
                                className={`${styles.actionButton} ${styles.neutral}`}
                                disabled={busyDevice === device.id}
                                onClick={() => handleCommand(device.id, "TOGGLE")}
                            >
                                تغییر وضعیت
                            </button>
                            <button
                                type="button"
                                className={styles.ghostButton}
                                disabled={busyDevice === device.id || loadingDevices}
                                onClick={() => refreshDeviceStatus(device.id)}
                            >
                                بروزرسانی وضعیت
                            </button>
                        </div>

                        <form
                            className={styles.scheduleForm}
                            onSubmit={(event) => handleScheduleSubmit(event, device.id)}
                            autoComplete="off"
                        >
                            <div className={styles.field}>
                                <span>زمان روشن شدن (local)</span>
                                <input
                                    type="datetime-local"
                                    value={device.schedule.turnOnAt}
                                    onChange={(e) =>
                                        updateDevice(device.id, (prev) => ({
                                            schedule: { ...prev.schedule, turnOnAt: e.target.value },
                                        }))
                                    }
                                    step="1"
                                />
                            </div>
                            <div className={styles.field}>
                                <span>زمان خاموش شدن (local)</span>
                                <input
                                    type="datetime-local"
                                    value={device.schedule.turnOffAt}
                                    onChange={(e) =>
                                        updateDevice(device.id, (prev) => ({
                                            schedule: { ...prev.schedule, turnOffAt: e.target.value },
                                        }))
                                    }
                                    step="1"
                                />
                            </div>
                            <div className={styles.field}>
                                <span>مدت (دقیقه)</span>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder="مثلا 90"
                                    value={device.schedule.durationMinutes}
                                    onChange={(e) =>
                                        updateDevice(device.id, (prev) => ({
                                            schedule: { ...prev.schedule, durationMinutes: e.target.value },
                                        }))
                                    }
                                />
                            </div>
                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={schedulingDevice === device.id}
                            >
                                {schedulingDevice === device.id ? "در حال ذخیره..." : "ثبت زمان‌بندی"}
                            </button>
                        </form>

                        <div className={styles.meta}>
                            <span>GET /api/shelly/devices/{device.id}/status</span>
                            <span>POST /api/shelly/devices/{device.id}/schedule</span>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}

export default ControlPanel;
