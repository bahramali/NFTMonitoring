import React, { useMemo, useState } from "react";
import styles from "./GerminationCamera.module.css";
import { CAMERA_CONFIG, isAdminUser } from "../../../config/cameras";
import LiveHlsPlayer from "../../../components/LiveHlsPlayer.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";

const DEFAULT_GERMINATION_CAMERA_ID = "S2L1";

export default function GerminationCamera() {
    const { role, roles, permissions } = useAuth();
    const user = useMemo(() => ({ role, roles, permissions }), [permissions, role, roles]);
    const isAdmin = isAdminUser(user);
    const camera = useMemo(
        () =>
            CAMERA_CONFIG.find((entry) => entry.id === DEFAULT_GERMINATION_CAMERA_ID) ||
            CAMERA_CONFIG[0] ||
            null,
        [],
    );
    const [reloadKey, setReloadKey] = useState(0);
    const [streamStatus, setStreamStatus] = useState("idle");
    const [streamError, setStreamError] = useState("");

    const handleReload = () => {
        setReloadKey((key) => key + 1);
        setStreamError("");
        setStreamStatus("loading");
    };

    const statusMessage = !isAdmin
        ? "Live is available to admins only."
        : streamError
            ? "Live stream unavailable."
            : streamStatus === "loading"
                ? "Loading stream…"
                : camera
                    ? `Live stream — ${camera.name}`
                    : "No camera feed configured for germination.";

    return (
        <div className={styles.wrapper}>
            {!isAdmin ? (
                <div className={styles.errorBox} role="alert">
                    <h3>Admins only</h3>
                    <p>Live camera access is restricted to admins.</p>
                </div>
            ) : camera ? (
                <LiveHlsPlayer
                    key={`${camera.id}-${reloadKey}`}
                    cameraId={camera.id}
                    reloadKey={reloadKey}
                    videoClassName={styles.video}
                    onStatusChange={(nextStatus) => {
                        setStreamStatus(nextStatus);
                        if (nextStatus === "playing") {
                            setStreamError("");
                        }
                    }}
                    onError={setStreamError}
                />
            ) : (
                <div className={styles.video} />
            )}
            <div className={styles.statusBar}>
                <span className={!camera || streamError || !isAdmin ? styles.error : ""}>
                    {statusMessage}
                </span>
                <button
                    type="button"
                    onClick={handleReload}
                    className={styles.reloadButton}
                    disabled={!isAdmin}
                >
                    Reload
                </button>
            </div>
        </div>
    );
}
