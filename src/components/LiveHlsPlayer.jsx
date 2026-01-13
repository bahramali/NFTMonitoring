import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./LiveHlsPlayer.module.css";
import { buildLiveHlsUrl } from "../config/cameras.js";

const STATUS = {
    idle: "idle",
    loading: "loading",
    playing: "playing",
    error: "error",
};

const ERROR_STATUS_CODES = new Set([404, 502]);
const PLAY_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

const getResponseErrorMessage = (statusCode) => {
    if (statusCode === 404) {
        return "We couldn't find this live stream. The camera may be offline.";
    }
    if (statusCode === 502) {
        return "The live stream is temporarily unavailable. Please try again.";
    }
    return "Unable to load the camera stream.";
};

export default function LiveHlsPlayer({
    cameraId,
    reloadKey = 0,
    videoClassName = "",
    wrapperClassName = "",
    videoRef: externalVideoRef,
    onStatusChange,
    onError,
}) {
    const localVideoRef = useRef(null);
    const videoRef = externalVideoRef || localVideoRef;
    const hlsRef = useRef(null);
    const [status, setStatus] = useState(STATUS.idle);
    const [errorMessage, setErrorMessage] = useState("");
    const [retryKey, setRetryKey] = useState(0);
    const retryTimerRef = useRef(null);
    const playAttemptRef = useRef(0);
    const onStatusChangeRef = useRef(onStatusChange);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onStatusChangeRef.current = onStatusChange;
    }, [onStatusChange]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    const updateStatus = (nextStatus) => {
        setStatus(nextStatus);
        onStatusChangeRef.current?.(nextStatus);
    };

    const clearRetryTimer = () => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    };

    const handleError = (message, error) => {
        console.error("[LiveHlsPlayer]", error);
        clearRetryTimer();
        setErrorMessage(message);
        onErrorRef.current?.(message);
        updateStatus(STATUS.error);
    };

    const cleanupHls = () => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    };

    const handleRetry = () => {
        cleanupHls();
        clearRetryTimer();
        setErrorMessage("");
        updateStatus(STATUS.loading);
        setRetryKey((key) => key + 1);
    };

    const hlsUrlInfo = useMemo(() => {
        if (!cameraId) {
            return { url: "", error: null };
        }
        try {
            return { url: buildLiveHlsUrl({ cameraId }), error: null };
        } catch (error) {
            return { url: "", error };
        }
    }, [cameraId]);

    useEffect(() => {
        let mounted = true;
        const abortController = new AbortController();
        const video = videoRef.current;
        const initialPlayRequested = { current: false };

        if (!video) {
            return undefined;
        }

        clearRetryTimer();
        playAttemptRef.current = 0;

        const handlePlaying = () => {
            if (!mounted) return;
            setErrorMessage("");
            updateStatus(STATUS.playing);
        };

        const handleVideoError = () => {
            if (!mounted) return;
            handleError("Unable to load the camera stream.", new Error("Video element error"));
        };

        const schedulePlayRetry = (error) => {
            if (!mounted) return;
            if (retryTimerRef.current) return;
            if (playAttemptRef.current >= PLAY_RETRY_DELAYS_MS.length) {
                handleError("Unable to start live playback.", error);
                return;
            }
            const delay = PLAY_RETRY_DELAYS_MS[playAttemptRef.current];
            playAttemptRef.current += 1;
            retryTimerRef.current = setTimeout(() => {
                retryTimerRef.current = null;
                safePlay();
            }, delay);
        };

        const safePlay = async () => {
            if (!mounted) return;
            try {
                await video.play();
            } catch (error) {
                if (!mounted) return;
                if (error?.name === "AbortError" || error?.name === "NotAllowedError") {
                    schedulePlayRetry(error);
                    return;
                }
                handleError("Unable to load the camera stream.", error);
            }
        };

        const requestInitialPlay = () => {
            if (!mounted || initialPlayRequested.current) return;
            initialPlayRequested.current = true;
            safePlay();
        };

        const start = async () => {
            if (!cameraId) {
                handleError("No camera selected.", new Error("Missing cameraId"));
                return;
            }

            if (hlsUrlInfo.error) {
                handleError("Live stream unavailable.", hlsUrlInfo.error);
                return;
            }
            const hlsUrl = hlsUrlInfo.url;
            if (!hlsUrl) {
                handleError("Offline / Unknown camera", new Error("Unknown cameraId"));
                return;
            }

            setErrorMessage("");
            updateStatus(STATUS.loading);

            video.addEventListener("playing", handlePlaying);
            video.addEventListener("error", handleVideoError);
            video.addEventListener("canplay", requestInitialPlay);
            video.muted = true;
            video.playsInline = true;

            try {
                if (video.canPlayType("application/vnd.apple.mpegurl")) {
                    const response = await fetch(hlsUrl, { signal: abortController.signal });
                    if (!response.ok && ERROR_STATUS_CODES.has(response.status)) {
                        const error = new Error(`HLS playlist error (${response.status})`);
                        error.statusCode = response.status;
                        throw error;
                    }
                    video.src = hlsUrl;
                    requestInitialPlay();
                    return;
                }

                if (!Hls.isSupported()) {
                    throw new Error("HLS playback is not supported in this browser.");
                }

                cleanupHls();

                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                });
                hlsRef.current = hls;

                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (!mounted) return;
                    const statusCode = data?.response?.code;
                    if (statusCode && ERROR_STATUS_CODES.has(statusCode)) {
                        handleError(getResponseErrorMessage(statusCode), data);
                        cleanupHls();
                        return;
                    }

                    if (data?.fatal) {
                        handleError("Live stream unavailable.", data);
                        cleanupHls();
                    }
                });

                hls.on(Hls.Events.MANIFEST_PARSED, requestInitialPlay);
                hls.loadSource(hlsUrl);
                hls.attachMedia(video);
            } catch (error) {
                handleError(getResponseErrorMessage(error?.statusCode), error);
            }
        };

        start();

        return () => {
            mounted = false;
            abortController.abort();
            clearRetryTimer();
            cleanupHls();
            video.removeEventListener("playing", handlePlaying);
            video.removeEventListener("error", handleVideoError);
            video.removeEventListener("canplay", requestInitialPlay);
            video.pause();
            video.removeAttribute("src");
            video.load();
        };
    }, [cameraId, hlsUrlInfo.error, hlsUrlInfo.url, reloadKey, retryKey, videoRef]);

    const overlayMessage =
        status === STATUS.loading
            ? "Loading stream…"
            : status === STATUS.error
                ? errorMessage || "Live stream unavailable."
                : "";

    const showRetry =
        status === STATUS.error && errorMessage !== "Offline / Unknown camera";

    return (
        <div className={`${styles.wrapper} ${wrapperClassName}`}>
            <video
                ref={videoRef}
                className={`${styles.video} ${videoClassName}`}
                autoPlay
                playsInline
                muted
            />
            {overlayMessage ? (
                <div className={styles.overlay} role="status" aria-live="polite">
                    <div className={styles.overlayContent}>
                        <p className={styles.message}>{overlayMessage}</p>
                        {showRetry ? (
                            <button
                                type="button"
                                className={styles.retryButton}
                                onClick={handleRetry}
                            >
                                Retry
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
