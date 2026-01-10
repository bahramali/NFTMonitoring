import React, { useEffect, useRef, useState } from "react";
import styles from "./LiveWebRTCPlayer.module.css";
import { buildLiveWebrtcUrl } from "../config/cameras.js";

const STATUS = {
    idle: "idle",
    loading: "loading",
    playing: "playing",
    error: "error",
};

const waitForIceGathering = (peerConnection) =>
    new Promise((resolve) => {
        if (peerConnection.iceGatheringState === "complete") {
            resolve();
            return;
        }
        const handleStateChange = () => {
            if (peerConnection.iceGatheringState === "complete") {
                peerConnection.removeEventListener("icegatheringstatechange", handleStateChange);
                resolve();
            }
        };
        peerConnection.addEventListener("icegatheringstatechange", handleStateChange);
    });

export default function LiveWebRTCPlayer({
    cameraId,
    user,
    reloadKey = 0,
    videoClassName = "",
    wrapperClassName = "",
    videoRef: externalVideoRef,
    onStatusChange,
    onError,
}) {
    const localVideoRef = useRef(null);
    const videoRef = externalVideoRef || localVideoRef;
    const [status, setStatus] = useState(STATUS.idle);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        let mounted = true;
        const abortController = new AbortController();
        const peerConnection = new RTCPeerConnection();
        const stream = new MediaStream();

        const updateStatus = (nextStatus) => {
            if (!mounted) return;
            setStatus(nextStatus);
            onStatusChange?.(nextStatus);
        };

        const handleError = (message, error) => {
            if (!mounted) return;
            console.error("[LiveWebRTCPlayer]", error);
            setErrorMessage(message);
            onError?.(message);
            updateStatus(STATUS.error);
        };

        const start = async () => {
            if (!cameraId) {
                handleError("No camera selected.", new Error("Missing cameraId"));
                return;
            }

            let webrtcUrl = "";
            try {
                webrtcUrl = buildLiveWebrtcUrl({ cameraId, user });
            } catch (error) {
                handleError(
                    "Live stream unavailable. This feature requires admin access and a reachable WebRTC endpoint.",
                    error,
                );
                return;
            }

            updateStatus(STATUS.loading);

            peerConnection.addTransceiver("video", { direction: "recvonly" });
            peerConnection.addTransceiver("audio", { direction: "recvonly" });

            peerConnection.ontrack = (event) => {
                if (!event.streams?.length) return;
                event.streams[0].getTracks().forEach((track) => {
                    if (!stream.getTracks().includes(track)) {
                        stream.addTrack(track);
                    }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                updateStatus(STATUS.playing);
            };

            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                await waitForIceGathering(peerConnection);
                const response = await fetch(webrtcUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(peerConnection.localDescription),
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    throw new Error(`WebRTC signaling failed (${response.status})`);
                }

                const answer = await response.json();
                const sdp = answer?.sdp || answer?.answer || "";
                const type = answer?.type || "answer";

                if (!sdp) {
                    throw new Error("WebRTC answer missing SDP.");
                }

                await peerConnection.setRemoteDescription({ type, sdp });
            } catch (error) {
                handleError(
                    "Live stream unavailable. This feature requires admin access and a reachable WebRTC endpoint.",
                    error,
                );
            }
        };

        start();

        return () => {
            mounted = false;
            abortController.abort();
            peerConnection.getSenders().forEach((sender) => sender.track?.stop());
            peerConnection.close();
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [cameraId, reloadKey, user, onError, onStatusChange]);

    const overlayMessage =
        status === STATUS.loading
            ? "Loading stream…"
            : status === STATUS.error
                ? errorMessage ||
                  "Live stream unavailable. This feature requires admin access and a reachable WebRTC endpoint."
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
                <div className={styles.overlay} role="status" aria-live="polite">
                    <p className={styles.message}>{overlayMessage}</p>
                </div>
            ) : null}
        </div>
    );
}
