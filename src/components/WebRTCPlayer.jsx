import React, { useEffect, useRef, useState } from "react";

const SIGNALING_BASE_URL =
    import.meta.env.REACT_APP_WEBRTC_SIGNALING_URL ||
    import.meta.env.VITE_MEDIAMTX_WEBRTC_ENDPOINT ||
    "http://localhost:8889";

const buildSignalingUrl = (baseUrl, streamName) => {
    const fallbackBase = baseUrl || "http://localhost:8889";
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
    idle: "idle",
    loading: "loading",
    playing: "playing",
    recovering: "recovering",
    offline: "offline",
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
    const [, setStatus] = useState(STATUS.idle);
    const onStatusChangeRef = useRef(onStatusChange);
    const onErrorRef = useRef(onError);
    const statusRef = useRef(STATUS.idle);

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

    useEffect(() => {
        let mounted = true;
        const peerConnection = new RTCPeerConnection();
        const abortController = new AbortController();
        const stream = new MediaStream();
        const videoElement = videoRef.current;
        const signalingUrl = buildSignalingUrl(SIGNALING_BASE_URL, streamName);

        if (!videoElement) {
            updateStatus(STATUS.offline);
            onErrorRef.current?.("Unable to load the camera stream.");
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
                return;
            }

            if (event.track) {
                stream.addTrack(event.track);
                attachStreamToVideo(stream);
                updateStatus(STATUS.playing);
            }
        };

        const handleConnectionState = () => {
            if (!mounted) return;
            const state = peerConnection.connectionState;
            if (state === "connected") {
                updateStatus(STATUS.playing);
                return;
            }
            if (state === "disconnected") {
                updateStatus(STATUS.recovering);
                return;
            }
            if (state === "failed" || state === "closed") {
                updateStatus(STATUS.offline);
                onErrorRef.current?.("Live stream unavailable.");
            }
        };

        const handleIceState = () => {
            if (!mounted) return;
            const state = peerConnection.iceConnectionState;
            if (state === "checking") {
                updateStatus(STATUS.loading);
                return;
            }
            if (state === "connected" || state === "completed") {
                updateStatus(STATUS.playing);
                return;
            }
            if (state === "disconnected") {
                updateStatus(STATUS.recovering);
                return;
            }
            if (state === "failed") {
                updateStatus(STATUS.offline);
                onErrorRef.current?.("Live stream unavailable.");
            }
        };

        const handlePlaying = () => {
            if (!mounted) return;
            updateStatus(STATUS.playing);
        };

        const runSignaling = async () => {
            try {
                updateStatus(STATUS.loading);
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
                    throw new Error("MediaMTX did not return an SDP answer.");
                }

                await peerConnection.setRemoteDescription(
                    new RTCSessionDescription({ type: answerType, sdp: answerSdp }),
                );
            } catch (error) {
                if (!mounted || error?.name === "AbortError") {
                    return;
                }
                updateStatus(STATUS.offline);
                onErrorRef.current?.("Unable to load the camera stream.");
                console.error("[WebRTCPlayer] Signaling failed.", error);
            }
        };

        peerConnection.addTransceiver("video", { direction: "recvonly" });
        peerConnection.addEventListener("track", handleTrackEvent);
        peerConnection.addEventListener("connectionstatechange", handleConnectionState);
        peerConnection.addEventListener("iceconnectionstatechange", handleIceState);
        videoElement.addEventListener("playing", handlePlaying);
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

    return (
        <div className={wrapperClassName}>
            <video ref={videoRef} className={videoClassName} autoPlay playsInline muted />
        </div>
    );
}
