import React, { useMemo, useState } from "react";
import styles from "./GerminationCamera.module.css";
import { CAMERA_CONFIG } from "../../../config/cameras";

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

    const handleReload = () => {
        setReloadKey((key) => key + 1);
    };

    const statusMessage = camera
        ? `Live stream — ${camera.name}`
        : "No camera feed configured for germination.";

    return (
        <div className={styles.wrapper}>
            {camera ? (
                <iframe
                    key={`${camera.id}-${reloadKey}`}
                    title={`${camera.name} germination stream`}
                    src={camera.webrtcUrl}
                    className={styles.video}
                    allow="autoplay; fullscreen"
                    allowFullScreen
                />
            ) : (
                <div className={styles.video} />
            )}
            <div className={styles.statusBar}>
                <span className={!camera ? styles.error : ""}>{statusMessage}</span>
                <button type="button" onClick={handleReload} className={styles.reloadButton}>
                    Reload
                </button>
            </div>
        </div>
    );
}
