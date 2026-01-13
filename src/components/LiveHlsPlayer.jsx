import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./LiveHlsPlayer.module.css";
import { buildLiveHlsUrl } from "../config/cameras.js";

const STATUS = {
    idle: "idle",
    loading: "loading",
    playing: "playing",
    recovering: "recovering",
    offline: "offline",
};

const ERROR_STATUS_CODES = new Set([404, 502]);
const PLAY_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
const MAX_RETRY_ATTEMPTS = 8;

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
    enabled = true,
}) {
    const localVideoRef = useRef(null);
    const videoRef = externalVideoRef || localVideoRef;
    const hlsRef = useRef(null);
    const [status, setStatus] = useState(STATUS.idle);
    const [errorMessage, setErrorMessage] = useState("");
    const retryTimerRef = useRef(null);
    const retryAttemptRef = useRef(0);
    const playAttemptIdRef = useRef(0);
    const abortControllerRef = useRef(null);
    const onStatusChangeRef = useRef(onStatusChange);
    const onErrorRef = useRef(onError);
    const statusRef = useRef(status);
    const startPlaybackRef = useRef(null);

    useEffect(() => {
        onStatusChangeRef.current = onStatusChange;
    }, [onStatusChange]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    const updateStatus = (nextStatus) => {
        setStatus(nextStatus);
        statusRef.current = nextStatus;
        onStatusChangeRef.current?.(nextStatus);
    };

    const clearRetryTimer = () => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    };

    const handleError = (message, error) => {
        if (error?.name !== "AbortError") {
            console.error("[LiveHlsPlayer]", error);
        }
        clearRetryTimer();
        setErrorMessage(message);
        onErrorRef.current?.(message);
        updateStatus(STATUS.offline);
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
        retryAttemptRef.current = 0;
        setErrorMessage("");
        updateStatus(STATUS.loading);
        startPlaybackRef.current?.();
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
        const video = videoRef.current;
        const initialPlayRequested = { current: false };

        if (!video || !enabled) {
            return undefined;
        }

        clearRetryTimer();
        retryAttemptRef.current = 0;

        const handlePlaying = () => {
            if (!mounted) return;
            setErrorMessage("");
            updateStatus(STATUS.playing);
        };

        const schedulePlayRetry = (error, messageOverride) => {
            if (!mounted) return;
            if (retryTimerRef.current) return;
            if (retryAttemptRef.current >= MAX_RETRY_ATTEMPTS) {
                handleError(messageOverride || "Unable to start live playback.", error);
                return;
            }
            const delay =
                PLAY_RETRY_DELAYS_MS[Math.min(retryAttemptRef.current, PLAY_RETRY_DELAYS_MS.length - 1)];
            retryAttemptRef.current += 1;
            updateStatus(STATUS.recovering);
            retryTimerRef.current = setTimeout(() => {
                retryTimerRef.current = null;
                startPlaybackRef.current?.();
            }, delay);
        };

        const safePlay = async (attemptId) => {
            if (!mounted) return;
            if (attemptId !== playAttemptIdRef.current) return;
            try {
                await video.play();
            } catch (error) {
                if (!mounted) return;
                if (error?.name === "AbortError") {
                    return;
                }
                if (error?.name === "NotAllowedError") {
                    schedulePlayRetry(error);
                    return;
                }
                schedulePlayRetry(error);
            }
        };

        const requestInitialPlay = () => {
            if (!mounted || initialPlayRequested.current) return;
            initialPlayRequested.current = true;
            safePlay(playAttemptIdRef.current);
        };

        const handleVideoError = () => {
            if (!mounted) return;
            schedulePlayRetry(new Error("Video element error"));
        };

        const start = async () => {
            if (!mounted) return;
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
            if (statusRef.current !== STATUS.recovering) {
                updateStatus(STATUS.loading);
            }

            initialPlayRequested.current = false;
            playAttemptIdRef.current += 1;

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            try {
                if (video.canPlayType("application/vnd.apple.mpegurl")) {
                    const response = await fetch(hlsUrl, { signal: abortController.signal });
                    if (!response.ok && ERROR_STATUS_CODES.has(response.status)) {
                        const error = new Error(`HLS playlist error (${response.status})`);
                        error.statusCode = response.status;
                        throw error;
                    }
                    video.src = hlsUrl;
                    return;
                }

                if (!Hls.isSupported()) {
                    throw new Error("HLS playback is not supported in this browser.");
                }

                if (!hlsRef.current) {
                    const hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: true,
                    });
                    hlsRef.current = hls;

                    hls.on(Hls.Events.ERROR, (_event, data) => {
                        if (!mounted) return;
                        const statusCode = data?.response?.code;
                        if (statusCode && ERROR_STATUS_CODES.has(statusCode)) {
                            schedulePlayRetry(data, getResponseErrorMessage(statusCode));
                            return;
                        }

                        if (data?.fatal) {
                            schedulePlayRetry(data, "Live stream unavailable.");
                        }
                    });

                    hls.on(Hls.Events.MANIFEST_PARSED, requestInitialPlay);
                }

                hlsRef.current.stopLoad();
                hlsRef.current.detachMedia();
                hlsRef.current.loadSource(hlsUrl);
                hlsRef.current.attachMedia(video);
            } catch (error) {
                schedulePlayRetry(error, getResponseErrorMessage(error?.statusCode));
            }
        };

        startPlaybackRef.current = start;

        video.addEventListener("playing", handlePlaying);
        video.addEventListener("error", handleVideoError);
        video.addEventListener("canplay", requestInitialPlay);
        video.muted = true;
        video.playsInline = true;

        start();

        return () => {
            mounted = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            clearRetryTimer();
            cleanupHls();
            video.removeEventListener("playing", handlePlaying);
            video.removeEventListener("error", handleVideoError);
            video.removeEventListener("canplay", requestInitialPlay);
            video.pause();
            video.removeAttribute("src");
            video.load();
        };
    }, [cameraId, enabled, hlsUrlInfo.error, hlsUrlInfo.url, videoRef]);

    useEffect(() => {
        if (!enabled) return;
        if (!startPlaybackRef.current) return;
        retryAttemptRef.current = 0;
        clearRetryTimer();
        startPlaybackRef.current();
    }, [enabled, reloadKey]);

    const overlayMessage =
        status === STATUS.loading
            ? "Loading stream…"
            : status === STATUS.recovering
                ? "Reconnecting…"
                : status === STATUS.offline
                    ? errorMessage || "Live stream unavailable."
                    : "";

    const showRetry =
        status === STATUS.offline && errorMessage !== "Offline / Unknown camera";

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
