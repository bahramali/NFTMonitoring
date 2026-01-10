import React, { useCallback, useEffect, useRef, useState } from "react";
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

    const updateStatus = useCallback(
        (nextStatus) => {
            setStatus(nextStatus);
            onStatusChange?.(nextStatus);
        },
        [onStatusChange],
    );

    const handleError = useCallback(
        (message, error) => {
            console.error("[LiveHlsPlayer]", error);
            setErrorMessage(message);
            onError?.(message);
            updateStatus(STATUS.error);
        },
        [onError, updateStatus],
    );

    const cleanupHls = useCallback(() => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    }, []);

    const handleRetry = useCallback(() => {
        cleanupHls();
        setErrorMessage("");
        updateStatus(STATUS.loading);
        setRetryKey((key) => key + 1);
    }, [cleanupHls, updateStatus]);

    useEffect(() => {
        let mounted = true;
        const abortController = new AbortController();
        const video = videoRef.current;

        if (!video) {
            return undefined;
        }

        const handlePlaying = () => {
            if (!mounted) return;
            setErrorMessage("");
            updateStatus(STATUS.playing);
        };

        const handleVideoError = () => {
            if (!mounted) return;
            handleError("Unable to load the camera stream.", new Error("Video element error"));
        };

        const start = async () => {
            if (!cameraId) {
                handleError("No camera selected.", new Error("Missing cameraId"));
                return;
            }

            let hlsUrl = "";
            try {
                hlsUrl = buildLiveHlsUrl({ cameraId });
            } catch (error) {
                handleError("Live stream unavailable.", error);
                return;
            }

            setErrorMessage("");
            updateStatus(STATUS.loading);

            video.addEventListener("playing", handlePlaying);
            video.addEventListener("error", handleVideoError);
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
                    await video.play();
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
            cleanupHls();
            video.removeEventListener("playing", handlePlaying);
            video.removeEventListener("error", handleVideoError);
            video.pause();
            video.removeAttribute("src");
            video.load();
        };
    }, [cameraId, cleanupHls, handleError, retryKey, reloadKey, updateStatus, videoRef]);

    const overlayMessage =
        status === STATUS.loading
            ? "Loading stream…"
            : status === STATUS.error
                ? errorMessage || "Live stream unavailable."
                : "";

    const showRetry = status === STATUS.error;

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
