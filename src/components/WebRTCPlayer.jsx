import React, { useEffect, useRef, useState } from "react";
import styles from "./WebRTCPlayer.module.css";

const resolveSignalingBaseUrl = () => {
    return import.meta.env.VITE_WEBRTC_SIGNALING_URL || "";
};

const buildSignalingUrl = (baseUrl, streamName) => {
    if (!baseUrl) {
        throw new Error(
            "Missing WebRTC signaling base URL. Set VITE_WEBRTC_SIGNALING_URL (no /v2/webrtc).",
        );
    }
    const fallbackBase = baseUrl;
    const encodedStream = encodeURIComponent(streamName || "");

    try {
        const url = new URL(fallbackBase);
        const hasWebRtcEndpoint = url.pathname.endsWith("/v2/webrtc");
        if (!hasWebRtcEndpoint) {
            const normalizedPath = url.pathname.endsWith("/")
                ? url.pathname.slice(0, -1)
                : url.pathname;
            url.pathname = `${normalizedPath}/v2/webrtc`;
        }
        if (streamName) {
            url.searchParams.set("path", streamName);
        }
        return url.toString();
    } catch {
        const normalizedBase = fallbackBase.replace(/\/$/, "");
        const query = streamName ? `?path=${encodedStream}` : "";
        return `${normalizedBase}/v2/webrtc${query}`;
    }
};

const STATUS = {
    connecting: "connecting",
    playing: "playing",
    error: "error",
};

export default function WebRTCPlayer({
    streamName = "stream",
    videoClassName = "",
    wrapperClassName = "",
    videoRef: externalVideoRef,
    onStatusChange,
    onError,
}) {
    const localVideoRef = useRef(null);
    const videoRef = externalVideoRef || localVideoRef;
    const [status, setStatus] = useState(STATUS.connecting);
    const [errorMessage, setErrorMessage] = useState("");
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

    const reportError = (message, error) => {
        if (error?.name !== "AbortError") {
            console.error("[WebRTCPlayer]", error);
        }
        setErrorMessage(message);
        onErrorRef.current?.(message);
        updateStatus(STATUS.error);
    };

    useEffect(() => {
        let mounted = true;
        const peerConnection = new RTCPeerConnection();
        const abortController = new AbortController();
        const stream = new MediaStream();
        const videoElement = videoRef.current;
        const signalingBaseUrl = resolveSignalingBaseUrl();
        updateStatus(STATUS.connecting);
        setErrorMessage("");
        if (!signalingBaseUrl) {
            reportError(
                "WebRTC signaling base URL is not configured. Set VITE_WEBRTC_SIGNALING_URL (no /v2/webrtc).",
            );
            return undefined;
        }
        const signalingUrl = buildSignalingUrl(signalingBaseUrl, streamName);

        if (!videoElement) {
            reportError("Unable to load the camera stream.");
            return undefined;
        }

        const attachStreamToVideo = (nextStream) => {
            if (!videoElement || !nextStream) {
                return;
            }

            if (videoElement.srcObject !== nextStream) {
                videoElement.srcObject = nextStream;
            }

            const playPromise = videoElement.play();
            if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch(() => {});
            }
        };

        const handleTrackEvent = (event) => {
            if (event.streams && event.streams[0]) {
                attachStreamToVideo(event.streams[0]);
                updateStatus(STATUS.playing);
                setErrorMessage("");
                return;
            }

            if (event.track) {
                stream.addTrack(event.track);
                attachStreamToVideo(stream);
                updateStatus(STATUS.playing);
                setErrorMessage("");
            }
        };

        const handleConnectionState = () => {
            if (!mounted) return;
            const state = peerConnection.connectionState;
            if (state === "connected") {
                updateStatus(STATUS.playing);
                setErrorMessage("");
                return;
            }
            if (state === "disconnected" || state === "connecting") {
                updateStatus(STATUS.connecting);
                return;
            }
            if (state === "failed" || state === "closed") {
                reportError("WebRTC connection failed. Please check the stream.");
                return;
            }
            updateStatus(STATUS.connecting);
        };

        const handleIceState = () => {
            if (!mounted) return;
            const state = peerConnection.iceConnectionState;
            if (state === "checking") {
                updateStatus(STATUS.connecting);
                return;
            }
            if (state === "connected" || state === "completed") {
                updateStatus(STATUS.playing);
                setErrorMessage("");
                return;
            }
            if (state === "disconnected") {
                updateStatus(STATUS.connecting);
                return;
            }
            if (state === "failed") {
                reportError("ICE negotiation failed. Unable to play the stream.");
            }
        };

        const handlePlaying = () => {
            if (!mounted) return;
            updateStatus(STATUS.playing);
            setErrorMessage("");
        };

        const handleVideoError = () => {
            if (!mounted) return;
            reportError("Media playback failed. Please try again.");
        };

        const runSignaling = async () => {
            let didTimeout = false;
            const timeoutId = setTimeout(() => {
                didTimeout = true;
                abortController.abort();
            }, 12000);
            try {
                updateStatus(STATUS.connecting);
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                const response = await fetch(signalingUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        type: peerConnection.localDescription?.type,
                        sdp: peerConnection.localDescription?.sdp,
                    }),
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    throw new Error(
                        `Signaling request failed with status ${response.status} ${response.statusText}`,
                    );
                }

                let answerSdp = "";
                let answerType = "answer";
                const contentType = response.headers.get("content-type") || "";

                if (contentType.includes("application/json")) {
                    const data = await response.json();
                    answerSdp = data?.sdp || data?.answer || "";
                    answerType = data?.type || "answer";
                } else {
                    answerSdp = await response.text();
                }

                if (!answerSdp) {
                    throw new Error("Signaling helper did not return an SDP answer.");
                }

                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription({ type: answerType, sdp: answerSdp }),
                );
            } catch (error) {
                if (!mounted) {
                    return;
                }
                if (error?.name === "AbortError") {
                    if (didTimeout) {
                        reportError("Signaling request timed out.", error);
                    }
                    return;
                }
                reportError(error?.message || "Unable to load the camera stream.", error);
            } finally {
                clearTimeout(timeoutId);
            }
        };

        peerConnection.addTransceiver("video", { direction: "recvonly" });
        peerConnection.addEventListener("track", handleTrackEvent);
        peerConnection.addEventListener("connectionstatechange", handleConnectionState);
        peerConnection.addEventListener("iceconnectionstatechange", handleIceState);
        videoElement.addEventListener("playing", handlePlaying);
        videoElement.addEventListener("error", handleVideoError);
        videoElement.muted = true;
        videoElement.playsInline = true;

        runSignaling();

        return () => {
            mounted = false;
            abortController.abort();
            peerConnection.removeEventListener("track", handleTrackEvent);
            peerConnection.removeEventListener("connectionstatechange", handleConnectionState);
            peerConnection.removeEventListener("iceconnectionstatechange", handleIceState);
            videoElement.removeEventListener("playing", handlePlaying);
            videoElement.removeEventListener("error", handleVideoError);
            stream.getTracks().forEach((track) => {
                track.stop();
            });
            peerConnection.getReceivers().forEach((receiver) => {
                receiver.track?.stop?.();
            });
            peerConnection.getSenders().forEach((sender) => {
                sender.track?.stop?.();
            });
            if (videoElement) {
                videoElement.srcObject = null;
            }
            peerConnection.close();
        };
    }, [streamName, videoRef]);

    const overlayMessage =
        status === STATUS.connecting
            ? "Connecting to live stream…"
            : status === STATUS.error
                ? errorMessage || "Live stream unavailable."
                : "";

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
                <div
                    className={styles.overlay}
                    role={status === STATUS.error ? "alert" : "status"}
                    aria-live="polite"
                >
                    <div className={styles.overlayContent}>
                        <p className={styles.message}>{overlayMessage}</p>
                    </div>
                </div>
            ) : null}
            <div
                className={`${styles.statusRow} ${
                    status === STATUS.error ? styles.statusError : ""
                }`}
                aria-live="polite"
            >
                Status: {status}
                {status === STATUS.error && errorMessage ? ` — ${errorMessage}` : ""}
            </div>
        </div>
    );
}
