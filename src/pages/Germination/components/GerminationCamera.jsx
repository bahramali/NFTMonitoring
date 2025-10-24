import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./GerminationCamera.module.css";
import { getCameraErrorMessage, DEFAULT_CAMERA_ERROR_MESSAGE } from "../../Cameras/errorMessages";

const STREAM_URL =
    (import.meta?.env && (import.meta.env.VITE_GERMINATION_HLS || import.meta.env.VITE_TAPO_HLS)) ||
    "https://cam.hydroleaf.se/tapo/index.m3u8";

const STATUS_MESSAGES = {
    loading: "Loading germination stream…",
    playing: "Live stream",
    interaction: "Autoplay blocked. Press play to start.",
    error: DEFAULT_CAMERA_ERROR_MESSAGE,
};

export default function GerminationCamera() {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
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
                console.warn("Failed to destroy germination hls instance", err);
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
        video.muted = true;
        video.playsInline = true;
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
                streamUrl: STREAM_URL,
                pageProtocol: typeof window !== "undefined" ? window.location?.protocol : undefined,
            });
            setState("error", errorMessage);
        };

        video.addEventListener("playing", onVideoPlaying);
        video.addEventListener("error", onVideoError);

        const cleanupVideo = () => {
            video.removeEventListener("playing", onVideoPlaying);
            video.removeEventListener("error", onVideoError);
            video.pause();
            video.removeAttribute("src");
            video.load();
        };

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = STREAM_URL;
            video.load();
            const onLoaded = () => handlePlaybackStart();
            video.addEventListener("loadedmetadata", onLoaded, { once: true });

            return () => {
                video.removeEventListener("loadedmetadata", onLoaded);
                cleanupVideo();
            };
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                liveSyncDuration: 2,
                liveMaxLatencyDuration: 6,
                maxLiveSyncPlaybackRate: 1.2,
                backBufferLength: 30,
            });
            hlsRef.current = hls;

            const onManifestParsed = () => handlePlaybackStart();
            const onHlsError = (_evt, data) => {
                console.error("HLS error on germination camera:", data);
                if (!data) return;
                if (!data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        setState("loading", "Network issue. Reconnecting…");
                    }
                    return;
                }

                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        setState("error", "Network error while fetching the stream.");
                        try {
                            hls.startLoad();
                        } catch (err) {
                            console.warn("Failed to restart germination HLS load", err);
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        setState("error", "Media error encountered. Attempting recovery…");
                        try {
                            hls.recoverMediaError();
                        } catch (err) {
                            console.warn("Failed to recover germination media error", err);
                        }
                        break;
                    default:
                        setState("error");
                        try {
                            hls.destroy();
                        } catch (err) {
                            console.warn("Failed to destroy germination hls after fatal error", err);
                        }
                        hlsRef.current = null;
                        break;
                }
            };

            hls.attachMedia(video);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(STREAM_URL);
            });
            hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
            hls.on(Hls.Events.ERROR, onHlsError);

            return () => {
                try {
                    hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
                    hls.off(Hls.Events.ERROR, onHlsError);
                    hls.destroy();
                } catch (err) {
                    console.warn("Failed to dispose germination hls", err);
                }
                hlsRef.current = null;
                cleanupVideo();
            };
        }

        video.src = STREAM_URL;
        video.load();
        const onLoaded = () => handlePlaybackStart();
        video.addEventListener("loadedmetadata", onLoaded, { once: true });

        return () => {
            video.removeEventListener("loadedmetadata", onLoaded);
            cleanupVideo();
        };
    }, [reloadKey]);

    const handleReload = () => {
        setReloadKey((key) => key + 1);
    };

    return (
        <div className={styles.wrapper}>
            <video
                key={reloadKey}
                ref={videoRef}
                className={styles.video}
                controls
                muted
                playsInline
            />
            <div className={styles.statusBar}>
                <span className={status.state === "error" ? styles.error : ""}>{status.message}</span>
                <button type="button" onClick={handleReload} className={styles.reloadButton}>
                    Reload
                </button>
            </div>
        </div>
    );
}
