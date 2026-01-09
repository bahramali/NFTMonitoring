import React, { useMemo, useState } from "react";
import styles from "./GerminationCamera.module.css";
import { buildWebrtcUrl, CAMERA_CONFIG } from "../../../config/cameras";

const DEFAULT_GERMINATION_CAMERA_ID = "tapo-38";

export default function GerminationCamera() {
    const camera = useMemo(
        () =>
            CAMERA_CONFIG.find((entry) => entry.id === DEFAULT_GERMINATION_CAMERA_ID) ||
            CAMERA_CONFIG[0] ||
            null,
        [],
    );
    const [reloadKey, setReloadKey] = useState(0);
    let cameraWebrtcUrl = null;
    let streamError = null;

    if (camera?.path) {
        try {
            cameraWebrtcUrl = buildWebrtcUrl(camera.path);
        } catch (error) {
            streamError = error instanceof Error ? error.message : "Unable to build stream URL.";
        }
    }

    const handleReload = () => {
        setReloadKey((key) => key + 1);
    };

    const statusMessage = streamError
        ? "Camera stream is not configured."
        : camera
            ? `Live stream — ${camera.name}`
            : "No camera feed configured for germination.";

    return (
        <div className={styles.wrapper}>
            {streamError ? (
                <div className={styles.errorBox} role="alert">
                    <h3>Camera stream is not configured</h3>
                    <p>{streamError}</p>
                </div>
            ) : camera ? (
                <iframe
                    key={`${camera.id}-${reloadKey}`}
                    title={`${camera.name} germination stream`}
                    src={cameraWebrtcUrl}
                    className={styles.video}
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen
                />
            ) : (
                <div className={styles.video} />
            )}
            <div className={styles.statusBar}>
                <span className={!camera || streamError ? styles.error : ""}>
                    {statusMessage}
                </span>
                <button
                    type="button"
                    onClick={handleReload}
                    className={styles.reloadButton}
                    disabled={Boolean(streamError)}
                >
                    Reload
                </button>
            </div>
        </div>
    );
}
