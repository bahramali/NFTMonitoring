// pages/Cameras/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Cameras.module.css";
import { buildWebrtcUrl, CAMERA_CONFIG } from "../../config/cameras";
import PageHeader from "../../components/PageHeader.jsx";

const STATUS_MESSAGES = {
    playing: "Live stream",
    reloading: "Refreshing stream",
    error: "No camera feeds are configured.",
};

const STATUS_CLASS = {
    playing: styles.statusPlaying,
    reloading: styles.statusLoading,
    error: styles.statusError,
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
    let previewUrl = null;
    let previewError = null;

    if (camera?.path) {
        try {
            previewUrl = buildWebrtcUrl(camera.path);
        } catch (error) {
            previewError = error instanceof Error ? error.message : "Unable to load preview.";
        }
    }

    return (
        <button
            type="button"
            onClick={() => onSelect(camera.id)}
            className={`${styles.cameraPreview} ${isActive ? styles.cameraPreviewActive : ""}`}
            aria-pressed={isActive}
        >
            <div className={styles.cameraPreviewVideoWrapper}>
                {previewError ? (
                    <div className={styles.cameraPreviewError}>
                        <span>Stream not configured</span>
                    </div>
                ) : (
                    <iframe
                        title={`${camera.name} preview`}
                        src={previewUrl}
                        className={styles.cameraPreviewVideo}
                        allow="autoplay; fullscreen; encrypted-media"
                        allowFullScreen
                        loading="lazy"
                    />
                )}
            </div>
            <div className={styles.cameraPreviewDetails}>
                <span className={styles.cameraName}>{camera.name}</span>
            </div>
        </button>
    );
}

export default function Cameras() {
    const [selectedCameraId, setSelectedCameraId] = useState(
        () => CAMERA_SOURCES[0]?.id ?? null,
    );
    const [isReloading, setIsReloading] = useState(false);
    const reloadTimeoutRef = useRef(null);
    const videoRef = useRef(null);
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
    let selectedWebrtcUrl = null;
    let streamError = null;

    if (selectedCamera?.path) {
        try {
            selectedWebrtcUrl = buildWebrtcUrl(selectedCamera.path);
        } catch (error) {
            streamError = error instanceof Error ? error.message : "Unable to build stream URL.";
        }
    }

    useEffect(() => {
        return () => {
            if (reloadTimeoutRef.current) {
                clearTimeout(reloadTimeoutRef.current);
            }
        };
    }, []);

    const handleReload = () => {
        setReloadKey((key) => key + 1);
        setIsReloading(true);
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
    const reloadDisabled = !selectedWebrtcUrl || hasStreamError;
    const canDisplayVideo = Boolean(selectedWebrtcUrl) && !hasStreamError;
    const statusState = isReloading
        ? "reloading"
        : selectedCamera && !hasStreamError
            ? "playing"
            : "error";
    const statusLabel = isReloading
        ? "Reconnecting"
        : canDisplayVideo
            ? "Live"
            : "Offline";
    const statusTone = isReloading ? "reconnecting" : canDisplayVideo ? "online" : "offline";

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

                    {hasStreamError ? (
                        <div className={styles.errorBox} role="alert">
                            <h3>Camera stream is not configured</h3>
                            <p>{streamError}</p>
                        </div>
                    ) : canDisplayVideo ? (
                        <iframe
                            key={`${selectedCamera?.id}-${reloadKey}`}
                            title={`${selectedCamera?.name || "Camera"} live stream`}
                            src={selectedWebrtcUrl}
                            className={styles.video}
                            allow="autoplay; fullscreen; encrypted-media"
                            allowFullScreen
                            ref={videoRef}
                        />
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
            </div>
        </div>
    );
}
