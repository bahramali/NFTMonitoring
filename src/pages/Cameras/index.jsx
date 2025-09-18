// pages/Cameras/index.jsx
import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./Cameras.module.css";
import { getCameraErrorMessage, DEFAULT_CAMERA_ERROR_MESSAGE } from "./errorMessages";

// pick URL from env or fallback
const SRC =
    (import.meta?.env && import.meta.env.VITE_TAPO_HLS) ||
    "https://cam.hydroleaf.se/tapo/index.m3u8";

const STATUS_MESSAGES = {
    loading: "Loading stream…",
    playing: "Live stream",
    interaction: "Autoplay was blocked. Press play on the player controls.",
    error: DEFAULT_CAMERA_ERROR_MESSAGE,
};

export default function Cameras() {
    const videoRef = useRef(null);
    const hlsRef = useRef(null); // keep instance for cleanup
    const [status, setStatus] = useState({ state: "loading", message: STATUS_MESSAGES.loading });
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return undefined;

        const setState = (state, message) => {
            setStatus({ state, message: message || STATUS_MESSAGES[state] || "" });
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
                streamUrl: SRC,
                pageProtocol: typeof window !== "undefined" ? window.location?.protocol : undefined,
            });
            setState("error", errorMessage);
        };

        video.addEventListener("playing", onVideoPlaying);
        video.addEventListener("error", onVideoError);

        // Native HLS (Safari/iOS)
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = SRC;
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
                hls.loadSource(SRC);
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
        video.src = SRC;
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
    }, [reloadKey]);

    const handleReload = () => {
        setReloadKey((key) => key + 1);
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

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Tapo Camera Stream</h2>
            <video
                ref={videoRef}
                className={styles.video}
                controls
                muted
                playsInline
                autoPlay
            />
            <div className={styles.statusRow}>
                <p className={`${styles.statusMessage} ${statusClass()}`} aria-live="polite">
                    {status.message || STATUS_MESSAGES[status.state] || ""}
                </p>
                <button
                    type="button"
                    className={styles.button}
                    onClick={handleReload}
                    disabled={status.state === "loading"}
                >
                    Reload
                </button>
            </div>
        </div>
    );
}
