// pages/Cameras/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Cameras.module.css";
import { CAMERA_CONFIG, isAdminUser } from "../../config/cameras";
import PageHeader from "../../components/PageHeader.jsx";
import LiveHlsPlayer from "../../components/LiveHlsPlayer.jsx";
import TimelapseGallery from "../../components/TimelapseGallery.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const STATUS_MESSAGES = {
    playing: "Live stream",
    reloading: "Refreshing stream",
    loading: "Loading stream",
    error: "Live stream unavailable.",
    restricted: "Live stream available to admins only.",
};

const STATUS_CLASS = {
    playing: styles.statusPlaying,
    reloading: styles.statusLoading,
    loading: styles.statusLoading,
    error: styles.statusError,
    restricted: styles.statusError,
};

const getStatusMessage = (state, camera) => {
    const base = STATUS_MESSAGES[state] || "";
    if (!camera?.name) {
        return base;
    }

    if (!base) {
        return camera.name;
    }

    if (state === "playing") {
        return `${base} — ${camera.name}`;
    }

    return `${base} (${camera.name})`;
};

const CAMERA_SOURCES = CAMERA_CONFIG;

function CameraPreview({ camera, isActive, onSelect }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(camera.id)}
            className={`${styles.cameraPreview} ${isActive ? styles.cameraPreviewActive : ""}`}
            aria-pressed={isActive}
        >
            <div className={styles.cameraPreviewVideoWrapper}>
                <div className={styles.cameraPreviewError}>
                    <span>Preview in player</span>
                </div>
            </div>
            <div className={styles.cameraPreviewDetails}>
                <span className={styles.cameraName}>{camera.name}</span>
            </div>
        </button>
    );
}

export default function Cameras() {
    const { role, roles, permissions } = useAuth();
    const user = useMemo(() => ({ role, roles, permissions }), [permissions, role, roles]);
    const isAdmin = isAdminUser(user);
    const [selectedCameraId, setSelectedCameraId] = useState(
        () => CAMERA_SOURCES[0]?.id ?? null,
    );
    const [isReloading, setIsReloading] = useState(false);
    const reloadTimeoutRef = useRef(null);
    const videoRef = useRef(null);
    const [streamStatus, setStreamStatus] = useState("idle");
    const [streamError, setStreamError] = useState("");
    const selectedCamera = useMemo(
        () =>
            CAMERA_SOURCES.find((camera) => camera.id === selectedCameraId) ||
            CAMERA_SOURCES[0] ||
            null,
        [selectedCameraId],
    );
    const selectedCameraIndex = useMemo(
        () =>
            CAMERA_SOURCES.findIndex((camera) => camera.id === selectedCamera?.id),
        [selectedCamera?.id],
    );
    const viewerPosition = selectedCameraIndex >= 0 ? selectedCameraIndex + 1 : 1;
    const hasMultipleCameras = CAMERA_SOURCES.length > 1;
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        return () => {
            if (reloadTimeoutRef.current) {
                clearTimeout(reloadTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setStreamError("");
        setStreamStatus("idle");
    }, [selectedCameraId]);

    const handleReload = () => {
        setReloadKey((key) => key + 1);
        setIsReloading(true);
        setStreamError("");
        setStreamStatus("loading");
        if (reloadTimeoutRef.current) {
            clearTimeout(reloadTimeoutRef.current);
        }
        reloadTimeoutRef.current = setTimeout(() => setIsReloading(false), 1500);
    };

    const handleCameraSelect = (cameraId) => {
        if (!cameraId || cameraId === selectedCameraId) return;
        setSelectedCameraId(cameraId);
    };

    const handleCameraStep = (direction) => {
        if (!hasMultipleCameras) return;
        const currentIndex = selectedCameraIndex >= 0 ? selectedCameraIndex : 0;
        const nextIndex =
            (currentIndex + direction + CAMERA_SOURCES.length) % CAMERA_SOURCES.length;
        const nextCamera = CAMERA_SOURCES[nextIndex];
        if (nextCamera?.id) {
            setSelectedCameraId(nextCamera.id);
        }
    };

    const handlePreviousCamera = () => handleCameraStep(-1);
    const handleNextCamera = () => handleCameraStep(1);

    const handleFullscreen = () => {
        const element = videoRef.current;
        if (!element?.requestFullscreen) {
            return;
        }
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
            return;
        }
        element.requestFullscreen();
    };

    const hasCameraSources = CAMERA_SOURCES.length > 0;
    const hasStreamError = Boolean(streamError);
    const canDisplayVideo = Boolean(selectedCamera?.id) && isAdmin;
    const reloadDisabled = !canDisplayVideo;
    const statusState = !isAdmin
        ? "restricted"
        : isReloading
            ? "reloading"
            : streamStatus === "playing"
                ? "playing"
                : streamStatus === "recovering"
                    ? "reloading"
                    : streamStatus === "loading" || streamStatus === "idle"
                        ? "loading"
                        : hasStreamError
                            ? "error"
                            : "error";
    const statusLabel = !isAdmin
        ? "Admins only"
        : isReloading ||
              streamStatus === "loading" ||
              streamStatus === "idle" ||
              streamStatus === "recovering"
            ? "Connecting"
            : streamStatus === "playing"
                ? "Live"
                : "Offline";
    const statusTone = !isAdmin
        ? "offline"
        : isReloading ||
              streamStatus === "loading" ||
              streamStatus === "idle" ||
              streamStatus === "recovering"
            ? "reconnecting"
            : streamStatus === "playing"
                ? "online"
                : "offline";

    return (
        <div className={styles.page}>
            <div className={styles.layout}>
                <PageHeader
                    breadcrumbItems={[
                        { label: "Monitoring", to: "/monitoring" },
                        { label: "Cameras", to: "/monitoring/cameras" },
                        { label: selectedCamera?.name || "Camera Stream" },
                    ]}
                    title={selectedCamera?.name || "Camera Stream"}
                    status={{ label: statusLabel, tone: statusTone }}
                    actions={[
                        {
                            label: "Reload",
                            onClick: handleReload,
                            disabled: reloadDisabled,
                            variant: "primary",
                        },
                        {
                            label: "Fullscreen",
                            onClick: handleFullscreen,
                            disabled: !canDisplayVideo,
                            variant: "ghost",
                        },
                    ]}
                    variant="dark"
                />
                <section className={styles.viewer}>
                    <div className={styles.videoHeader}>
                        <div>
                            <h2 className={styles.title}>{selectedCamera?.name || "Camera Stream"}</h2>
                        </div>
                        <button
                            type="button"
                            className={styles.button}
                            onClick={handleReload}
                            disabled={reloadDisabled}
                        >
                            Reload
                        </button>
                    </div>

                    {!isAdmin ? (
                        <div className={styles.emptyState}>
                            <strong>Live view is available to admins only.</strong>
                            <span>Timelapse videos remain available to all users.</span>
                        </div>
                    ) : canDisplayVideo ? (
                        <LiveHlsPlayer
                            key={`${selectedCamera?.id}-${reloadKey}`}
                            cameraId={selectedCamera?.id}
                            reloadKey={reloadKey}
                            videoClassName={styles.video}
                            wrapperClassName={styles.videoWrapper}
                            videoRef={videoRef}
                            onStatusChange={(nextStatus) => {
                                setStreamStatus(nextStatus);
                                if (nextStatus === "playing") {
                                    setStreamError("");
                                }
                            }}
                            onError={setStreamError}
                        />
                    ) : hasStreamError ? (
                        <div className={styles.errorBox} role="alert">
                            <h3>Live stream unavailable</h3>
                            <p>{streamError}</p>
                        </div>
                    ) : (
                        <div className={styles.emptyState}>
                            <strong>No live preview available.</strong>
                            <span>Provide a valid stream URL to start monitoring.</span>
                        </div>
                    )}

                    {hasMultipleCameras ? (
                        <div className={styles.videoNavigation}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={handlePreviousCamera}
                                aria-label="View previous camera"
                            >
                                Previous
                            </button>
                            <span className={styles.viewerPosition}>
                                {viewerPosition} / {CAMERA_SOURCES.length}
                            </span>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={handleNextCamera}
                                aria-label="View next camera"
                            >
                                Next
                            </button>
                        </div>
                    ) : null}

                    <div className={styles.statusRow}>
                        <p
                            className={`${styles.statusMessage} ${
                                STATUS_CLASS[statusState] || styles.statusError
                            }`}
                            aria-live="polite"
                        >
                            {getStatusMessage(statusState, selectedCamera)}
                        </p>
                    </div>
                </section>

                <section className={styles.selectorPanel}>
                    <div className={styles.selectorHeader}>
                        <h2 className={styles.selectorTitle}>Available Cameras</h2>
                        <p className={styles.selectorHint}>Select a feed to view it below.</p>
                    </div>
                    {hasCameraSources ? (
                        <ul className={styles.cameraList}>
                            {CAMERA_SOURCES.map((camera) => {
                                const isActive = camera.id === selectedCamera?.id;
                                return (
                                    <li key={camera.id}>
                                        <CameraPreview
                                            camera={camera}
                                            isActive={isActive}
                                            onSelect={handleCameraSelect}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className={styles.emptySelectorMessage}>
                            No camera feeds configured yet.
                        </p>
                    )}
                </section>
                <TimelapseGallery />
            </div>
        </div>
    );
}
