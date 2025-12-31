// pages/Cameras/index.jsx
import React, { useMemo, useState } from "react";
import styles from "./Cameras.module.css";
import { CAMERA_CONFIG } from "../../config/cameras";

const STATUS_MESSAGES = {
    playing: "Live stream",
    error: "No camera feeds are configured.",
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
                <iframe
                    title={`${camera.name} preview`}
                    src={camera.webrtcUrl}
                    className={styles.cameraPreviewVideo}
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    loading="lazy"
                />
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

    const handleReload = () => {
        setReloadKey((key) => key + 1);
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

    const hasCameraSources = CAMERA_SOURCES.length > 0;
    const reloadDisabled = !selectedCamera?.webrtcUrl;
    const canDisplayVideo = Boolean(selectedCamera?.webrtcUrl);
    const statusState = selectedCamera ? "playing" : "error";

    return (
        <div className={styles.page}>
            <div className={styles.layout}>
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

                    {canDisplayVideo ? (
                        <iframe
                            key={`${selectedCamera?.id}-${reloadKey}`}
                            title={`${selectedCamera?.name || "Camera"} live stream`}
                            src={selectedCamera?.webrtcUrl}
                            className={styles.video}
                            allow="autoplay; fullscreen"
                            allowFullScreen
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
                                statusState === "playing"
                                    ? styles.statusPlaying
                                    : styles.statusError
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
