// pages/Cameras/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./Cameras.module.css";
import { getCameraErrorMessage, DEFAULT_CAMERA_ERROR_MESSAGE } from "./errorMessages";

const DEFAULT_CAMERA_SOURCES = [
    {
        id: "tapo-main",
        name: "Tapo Main Camera",
        streamUrl:
            (import.meta?.env && import.meta.env.VITE_TAPO_HLS) ||
            "https://cam.hydroleaf.se/tapo/index.m3u8",
        description: "Primary overview feed from the grow room.",
    },
    {
        id: "s01-layer-03",
        name: "Shelf S01 · Layer 03",
        streamUrl:
            (import.meta?.env && import.meta.env.VITE_S01L03_HLS) ||
            "https://cam.hydroleaf.se/s01l03/index.m3u8",
        description: "Detail view of shelf S01 on layer 03.",
    },
];

const STATUS_MESSAGES = {
    loading: "Loading stream…",
    playing: "Live stream",
    interaction: "Autoplay was blocked. Press play on the player controls.",
    error: DEFAULT_CAMERA_ERROR_MESSAGE,
};

const getStatusMessage = (state, camera) => {
    const base = STATUS_MESSAGES[state] || "";
    if (!camera?.name) {
        return state === "loading" ? "Loading stream…" : base;
    }

    if (state === "loading") {
        return `Preparing ${camera.name}…`;
    }

    if (!base) {
        return camera.name;
    }

    if (state === "playing") {
        return `${base} — ${camera.name}`;
    }

    return `${base} (${camera.name})`;
};

const parseCameraSourcesFromEnv = () => {
    const envValue = import.meta?.env?.VITE_CAMERA_SOURCES;
    if (!envValue) return undefined;

    try {
        const parsed = JSON.parse(envValue);
        if (!Array.isArray(parsed)) return undefined;

        const normalised = parsed
            .filter((camera) => camera && camera.streamUrl)
            .map((camera, index) => ({
                id: camera.id || camera.name || `camera-${index + 1}`,
                name: camera.name || `Camera ${index + 1}`,
                streamUrl: camera.streamUrl,
                description: camera.description || "",
            }));

        return normalised.length > 0 ? normalised : undefined;
    } catch (error) {
        console.warn("Invalid VITE_CAMERA_SOURCES value", error);
        return undefined;
    }
};

const CAMERA_SOURCES = parseCameraSourcesFromEnv() || DEFAULT_CAMERA_SOURCES;

export default function Cameras() {
    const videoRef = useRef(null);
    const hlsRef = useRef(null); // keep instance for cleanup
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
    const [status, setStatus] = useState(() => ({
        state: "loading",
        message: getStatusMessage("loading", selectedCamera),
    }));
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!selectedCamera) {
            setStatus({
                state: "error",
                message: "No camera feeds are configured.",
            });
            return;
        }

        setStatus({ state: "loading", message: getStatusMessage("loading", selectedCamera) });
    }, [selectedCamera]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return undefined;

        if (!selectedCamera?.streamUrl) {
            setStatus({
                state: "error",
                message: `Missing stream URL for ${selectedCamera?.name || "the selected camera"}.`,
            });
            return undefined;
        }

        const setState = (state, message) => {
            setStatus({
                state,
                message: message || getStatusMessage(state, selectedCamera),
            });
        };

        const cleanupHls = () => {
            if (!hlsRef.current) return;
            try {
                hlsRef.current.destroy();
            } catch (err) {
                console.warn("Failed to destroy hls instance", err);
            }
            hlsRef.current = null;
        };

        cleanupHls();

        video.pause();
        video.removeAttribute("src");
        video.load();

        setState("loading");

        video.crossOrigin = "anonymous";
        video.autoplay = true;
        video.muted = true; // required for autoplay
        video.playsInline = true; // iOS inline
        video.preload = "auto";

        const handlePlaybackStart = () => {
            try {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.then === "function") {
                    playPromise
                        .then(() => setState("playing"))
                        .catch(() => setState("interaction"));
                } else {
                    setState("playing");
                }
            } catch (err) {
                console.error("Playback start error", err);
                setState("interaction");
            }
        };

        const onVideoPlaying = () => setState("playing");
        const onVideoError = () => {
            const errorMessage = getCameraErrorMessage({
                errorCode: video?.error?.code,
                errorMessage: video?.error?.message,
                streamUrl: selectedCamera?.streamUrl,
                pageProtocol: typeof window !== "undefined" ? window.location?.protocol : undefined,
            });
            setState("error", errorMessage);
        };

        video.addEventListener("playing", onVideoPlaying);
        video.addEventListener("error", onVideoError);

        // Native HLS (Safari/iOS)
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = selectedCamera.streamUrl;
            video.load();
            const onLoaded = () => handlePlaybackStart();
            video.addEventListener("loadedmetadata", onLoaded, { once: true });

            return () => {
                video.removeEventListener("loadedmetadata", onLoaded);
                video.removeEventListener("playing", onVideoPlaying);
                video.removeEventListener("error", onVideoError);
                video.pause();
                video.removeAttribute("src");
                video.load();
            };
        }

        // hls.js for other browsers
        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false, // classic HLS; stable with MediaMTX mpegts
                liveSyncDuration: 2,
                liveMaxLatencyDuration: 6,
                maxLiveSyncPlaybackRate: 1.2,
                backBufferLength: 30,
            });
            hlsRef.current = hls;

            const onManifestParsed = () => handlePlaybackStart();
            const onHlsError = (_evt, data) => {
                console.error("HLS error:", data);
                if (!data) return;
                if (!data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        setState("loading", "Network hiccup detected. Reconnecting…");
                    }
                    return;
                }

                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        setState("error", "Network error while fetching the stream.");
                        try {
                            hls.startLoad();
                        } catch (err) {
                            console.warn("Failed to restart HLS load", err);
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        setState("error", "Media error encountered. Attempting recovery…");
                        try {
                            hls.recoverMediaError();
                        } catch (err) {
                            console.warn("Failed to recover media error", err);
                        }
                        break;
                    default:
                        setState("error");
                        try {
                            hls.destroy();
                        } catch (err) {
                            console.warn("Failed to destroy hls after fatal error", err);
                        }
                        hlsRef.current = null;
                        break;
                }
            };

            hls.attachMedia(video);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(selectedCamera.streamUrl);
            });
            hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hls.on(Hls.Events.ERROR, onHlsError);

            return () => {
                video.removeEventListener("playing", onVideoPlaying);
                video.removeEventListener("error", onVideoError);
                try {
                    hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
                    hls.off(Hls.Events.ERROR, onHlsError);
                    hls.destroy();
                } catch (err) {
                    console.warn("Failed to dispose hls", err);
                }
                hlsRef.current = null;
                video.pause();
                video.removeAttribute("src");
                video.load();
            };
        }

        // ultimate fallback
        video.src = selectedCamera.streamUrl;
        video.load();
        const onLoaded = () => handlePlaybackStart();
        video.addEventListener("loadedmetadata", onLoaded, { once: true });

        return () => {
            video.removeEventListener("loadedmetadata", onLoaded);
            video.removeEventListener("playing", onVideoPlaying);
            video.removeEventListener("error", onVideoError);
            video.pause();
            video.removeAttribute("src");
            video.load();
        };
    }, [reloadKey, selectedCamera]);

    const handleReload = () => {
        setReloadKey((key) => key + 1);
    };

    const handleCameraSelect = (cameraId) => {
        if (!cameraId || cameraId === selectedCameraId) return;
        setSelectedCameraId(cameraId);
    };

    const statusClass = () => {
        switch (status.state) {
            case "playing":
                return styles.statusPlaying;
            case "interaction":
                return styles.statusInteraction;
            case "error":
                return styles.statusError;
            case "loading":
                return styles.statusLoading;
            default:
                return "";
        }
    };

    const hasCameraSources = CAMERA_SOURCES.length > 0;
    const reloadDisabled = status.state === "loading" || !selectedCamera?.streamUrl;
    const canDisplayVideo = Boolean(selectedCamera?.streamUrl);

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.selector}>
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
                                        <button
                                            type="button"
                                            onClick={() => handleCameraSelect(camera.id)}
                                            className={`${styles.cameraButton} ${
                                                isActive ? styles.cameraButtonActive : ""
                                            }`}
                                            aria-pressed={isActive}
                                        >
                                            <span className={styles.cameraName}>{camera.name}</span>
                                            {camera.description ? (
                                                <span className={styles.cameraDescription}>
                                                    {camera.description}
                                                </span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className={styles.emptySelectorMessage}>
                            No camera feeds configured yet.
                        </p>
                    )}
                </div>

                <section className={styles.viewer}>
                    <div className={styles.videoHeader}>
                        <div>
                            <h2 className={styles.title}>{selectedCamera?.name || "Camera Stream"}</h2>
                            {selectedCamera?.description ? (
                                <p className={styles.subtitle}>{selectedCamera.description}</p>
                            ) : null}
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
                        <video
                            ref={videoRef}
                            key={selectedCamera?.id}
                            className={styles.video}
                            controls
                            muted
                            playsInline
                            autoPlay
                        />
                    ) : (
                        <div className={styles.emptyState}>
                            <strong>No live preview available.</strong>
                            <span>Provide a valid stream URL to start monitoring.</span>
                        </div>
                    )}

                    <div className={styles.statusRow}>
                        <p className={`${styles.statusMessage} ${statusClass()}`} aria-live="polite">
                            {status.message || STATUS_MESSAGES[status.state] || ""}
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
