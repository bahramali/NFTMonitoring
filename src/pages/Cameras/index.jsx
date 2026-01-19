import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Cameras.module.css";
import PageHeader from "../../components/PageHeader.jsx";
import MediaMTXWebRTCPlayer from "../../components/MediaMTXWebRTCPlayer.jsx";

const CAMERA_PATHS = [
    { id: "s01l01", label: "s01l01" },
    { id: "S2L1", label: "S2L1" },
    { id: "S2L2", label: "S2L2" },
    { id: "S2L3", label: "S2L3" },
    { id: "S2L4", label: "S2L4" },
];

const STREAM_MODES = [
    { id: "iframe", label: "Iframe player" },
    { id: "webrtc", label: "WebRTC (MediaMTX)" },
];

const CAM_BASE_URL = "https://cam.hydroleaf.se:8443";

const buildPlayerUrl = (path) => (path ? `${CAM_BASE_URL}/${path}/` : "");
const buildWhepUrl = (path) => (path ? `${CAM_BASE_URL}/${path}/whep` : "");

const STATUS_LABELS = {
    idle: "Idle",
    loading: "Connecting",
    playing: "Live",
    error: "Offline",
};

const STATUS_MESSAGES = {
    idle: "Select a camera path to begin.",
    loading: "Connecting to the selected camera stream…",
    playing: "Live stream is active.",
    error: "Live stream unavailable.",
};

export default function Cameras() {
    const [selectedPath, setSelectedPath] = useState(CAMERA_PATHS[0]?.id ?? "");
    const [streamMode, setStreamMode] = useState(STREAM_MODES[0]?.id ?? "iframe");
    const [status, setStatus] = useState("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const videoRef = useRef(null);

    const playerUrl = useMemo(() => buildPlayerUrl(selectedPath), [selectedPath]);
    const whepUrl = useMemo(() => buildWhepUrl(selectedPath), [selectedPath]);

    useEffect(() => {
        setStatus(selectedPath ? "loading" : "idle");
        setErrorMessage("");
    }, [selectedPath, streamMode]);

    const handleIframeLoad = () => {
        setStatus("playing");
        setErrorMessage("");
    };

    const handleIframeError = () => {
        setStatus("error");
        setErrorMessage("Unable to load the player page for this camera.");
    };

    const handleStatusChange = (nextStatus) => {
        setStatus(nextStatus);
    };

    const handleStreamError = (message) => {
        setErrorMessage(message);
        setStatus("error");
    };

    const statusTone = status === "playing"
        ? "online"
        : status === "loading"
            ? "reconnecting"
            : "offline";

    const statusMessage = errorMessage || STATUS_MESSAGES[status] || "";

    return (
        <div className={styles.page}>
            <div className={styles.layout}>
                <PageHeader
                    breadcrumbItems={[
                        { label: "Monitoring", to: "/monitoring" },
                        { label: "Cameras", to: "/monitoring/cameras" },
                        { label: selectedPath || "Camera Stream" },
                    ]}
                    title={selectedPath || "Camera Stream"}
                    status={{ label: STATUS_LABELS[status] || "Status", tone: statusTone }}
                    variant="dark"
                />

                <section className={styles.viewer}>
                    <div className={styles.videoHeader}>
                        <div>
                            <h2 className={styles.title}>{selectedPath || "Camera Stream"}</h2>
                            <p className={styles.subtitle}>
                                Paths are case-sensitive. Select from the approved list only.
                            </p>
                        </div>
                    </div>

                    <div className={styles.controls}>
                        <label className={styles.controlGroup} htmlFor="camera-path">
                            <span className={styles.controlLabel}>Camera path</span>
                            <select
                                id="camera-path"
                                className={styles.select}
                                value={selectedPath}
                                onChange={(event) => setSelectedPath(event.target.value)}
                            >
                                {CAMERA_PATHS.map((path) => (
                                    <option key={path.id} value={path.id}>
                                        {path.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className={styles.controlGroup}>
                            <span className={styles.controlLabel}>Mode</span>
                            <div className={styles.modeGroup}>
                                {STREAM_MODES.map((mode) => (
                                    <label key={mode.id} className={styles.modeOption}>
                                        <input
                                            type="radio"
                                            name="stream-mode"
                                            value={mode.id}
                                            checked={streamMode === mode.id}
                                            onChange={() => setStreamMode(mode.id)}
                                        />
                                        <span>{mode.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {streamMode === "iframe" ? (
                        <iframe
                            title={`Camera ${selectedPath}`}
                            src={playerUrl}
                            className={`${styles.video} ${styles.videoFrame}`}
                            allow="autoplay; fullscreen"
                            loading="lazy"
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
                        />
                    ) : (
                        <MediaMTXWebRTCPlayer
                            whepUrl={whepUrl}
                            videoClassName={styles.video}
                            wrapperClassName={styles.videoWrapper}
                            videoRef={videoRef}
                            onStatusChange={handleStatusChange}
                            onError={handleStreamError}
                        />
                    )}

                    <div className={styles.statusRow}>
                        <p
                            className={`${styles.statusMessage} ${
                                status === "playing"
                                    ? styles.statusPlaying
                                    : status === "loading"
                                        ? styles.statusLoading
                                        : styles.statusError
                            }`}
                            aria-live="polite"
                        >
                            {statusMessage}
                        </p>
                    </div>
                </section>

                <section className={styles.selectorPanel}>
                    <div className={styles.selectorHeader}>
                        <h2 className={styles.selectorTitle}>Available camera paths</h2>
                        <p className={styles.selectorHint}>
                            Use the selector above to switch streams. Paths are case-sensitive.
                        </p>
                    </div>
                    <ul className={styles.cameraList}>
                        {CAMERA_PATHS.map((camera) => (
                            <li key={camera.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPath(camera.id)}
                                    className={`${styles.cameraPreview} ${
                                        selectedPath === camera.id ? styles.cameraPreviewActive : ""
                                    }`}
                                    aria-pressed={selectedPath === camera.id}
                                >
                                    <div className={styles.cameraPreviewVideoWrapper}>
                                        <div className={styles.cameraPreviewError}>
                                            <span>{camera.label}</span>
                                        </div>
                                    </div>
                                    <div className={styles.cameraPreviewDetails}>
                                        <span className={styles.cameraName}>{camera.label}</span>
                                        <span className={styles.cameraDescription}>
                                            Whitelisted path only
                                        </span>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}
