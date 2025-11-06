import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./GerminationCamera.module.css";
import { getCameraErrorMessage, DEFAULT_CAMERA_ERROR_MESSAGE } from "../../Cameras/errorMessages";

const STREAM_URL =
    (import.meta?.env && (import.meta.env.VITE_GERMINATION_HLS || import.meta.env.VITE_TAPO_HLS)) ||
    "https://cam.hydroleaf.se/germination/index.m3u8";

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
    const detectionCanvasRef = useRef(null);
    const detectionFrameRef = useRef(null);
    const detectionStateRef = useRef({ previous: null, flowFrames: 0, stillFrames: 0, lastFlow: false });
    const [flowStatus, setFlowStatus] = useState({ detected: false, message: null });

    const setFlowIndicator = useCallback((detected, message) => {
        const nextMessage = message ?? null;
        setFlowStatus((prev) => {
            if (prev.detected === detected && prev.message === nextMessage) {
                return prev;
            }
            return { detected, message: nextMessage };
        });
    }, []);

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
        if (detectionFrameRef.current) {
            cancelAnimationFrame(detectionFrameRef.current);
            detectionFrameRef.current = null;
        }
        detectionStateRef.current = { previous: null, flowFrames: 0, stillFrames: 0, lastFlow: false };
        setFlowIndicator(false);
        setReloadKey((key) => key + 1);
    };

    useEffect(() => {
        const video = videoRef.current;

        if (detectionFrameRef.current) {
            cancelAnimationFrame(detectionFrameRef.current);
            detectionFrameRef.current = null;
        }

        detectionStateRef.current = { previous: null, flowFrames: 0, stillFrames: 0, lastFlow: false };

        if (!video) {
            return undefined;
        }

        if (status.state !== "playing") {
            switch (status.state) {
                case "loading":
                    setFlowIndicator(false);
                    break;
                case "interaction":
                    setFlowIndicator(false);
                    break;
                case "error":
                    setFlowIndicator(false);
                    break;
                default:
                    setFlowIndicator(false);
                    break;
            }
            return undefined;
        }

        const canvas = detectionCanvasRef.current || document.createElement("canvas");
        detectionCanvasRef.current = canvas;
        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) {
            setFlowIndicator(false);
            return undefined;
        }

        setFlowIndicator(false);

        const FLOW_THRESHOLD = 18;
        const FLOW_STREAK_TARGET = 6;
        const STILL_STREAK_TARGET = 12;
        const SAMPLE_STEP = 160;

        const analyzeFrame = () => {
            if (!video || video.paused || video.ended || video.readyState < 2) {
                detectionFrameRef.current = requestAnimationFrame(analyzeFrame);
                return;
            }

            const width = video.videoWidth;
            const height = video.videoHeight;

            if (!width || !height) {
                detectionFrameRef.current = requestAnimationFrame(analyzeFrame);
                return;
            }

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                detectionStateRef.current.previous = null;
            }

            context.drawImage(video, 0, 0, width, height);
            const frame = context.getImageData(0, 0, width, height);
            const data = frame.data;
            const state = detectionStateRef.current;

            if (state.previous) {
                let diff = 0;
                let samples = 0;

                for (let i = 0; i + 2 < data.length; i += SAMPLE_STEP) {
                    const current = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    const previous = (state.previous[i] + state.previous[i + 1] + state.previous[i + 2]) / 3;
                    diff += Math.abs(current - previous);
                    samples += 1;
                }

                const avgDiff = samples ? diff / samples : 0;

                if (avgDiff > FLOW_THRESHOLD) {
                    state.flowFrames = Math.min(state.flowFrames + 1, FLOW_STREAK_TARGET);
                    state.stillFrames = 0;
                } else {
                    state.stillFrames = Math.min(state.stillFrames + 1, STILL_STREAK_TARGET);
                    state.flowFrames = 0;
                }

                if (!state.lastFlow && state.flowFrames >= FLOW_STREAK_TARGET) {
                    state.lastFlow = true;
                    setFlowIndicator(true, "Water flow detected");
                } else if (state.lastFlow && state.stillFrames >= STILL_STREAK_TARGET) {
                    state.lastFlow = false;
                    setFlowIndicator(false);
                }
            }

            state.previous = new Uint8ClampedArray(data);

            detectionFrameRef.current = requestAnimationFrame(analyzeFrame);
        };

        detectionFrameRef.current = requestAnimationFrame(analyzeFrame);

        return () => {
            if (detectionFrameRef.current) {
                cancelAnimationFrame(detectionFrameRef.current);
                detectionFrameRef.current = null;
            }
        };
    }, [reloadKey, setFlowIndicator, status.state]);

    return (
        <div className={styles.wrapper}>
            {flowStatus.message ? (
                <div
                    className={`${styles.flowIndicator} ${flowStatus.detected ? styles.flowIndicatorActive : ""}`}
                >
                    <span
                        className={`${styles.flowDot} ${flowStatus.detected ? styles.flowDotActive : ""}`}
                    />
                    {flowStatus.message}
                </div>
            ) : null}
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
