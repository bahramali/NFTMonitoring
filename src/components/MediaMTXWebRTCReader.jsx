import React, { useEffect, useRef } from "react";

export default function MediaMTXWebRTCReader({ whepUrl, onStateChange, onError, className }) {
    const videoRef = useRef(null);

    useEffect(() => {
        let peerConnection = null;
        let isActive = true;
        const abortController = new AbortController();
        const videoElement = videoRef.current;

        const updateState = (state) => {
            if (onStateChange) {
                onStateChange(state);
            }
        };

        const cleanupVideo = () => {
            if (!videoElement?.srcObject) return;
            const tracks = videoElement.srcObject.getTracks?.() ?? [];
            tracks.forEach((track) => track.stop());
            videoElement.srcObject = null;
        };

        const start = async () => {
            updateState("loading");
            peerConnection = new RTCPeerConnection();
            peerConnection.addTransceiver("video", { direction: "recvonly" });
            peerConnection.addTransceiver("audio", { direction: "recvonly" });

            peerConnection.ontrack = (event) => {
                if (!videoElement) return;
                const [stream] = event.streams;
                if (stream) {
                    videoElement.srcObject = stream;
                } else {
                    const mediaStream = new MediaStream([event.track]);
                    videoElement.srcObject = mediaStream;
                }
            };

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            const response = await fetch(whepUrl, {
                method: "POST",
                headers: { "Content-Type": "application/sdp" },
                body: offer.sdp,
                signal: abortController.signal,
            });

            if (!response.ok) {
                throw new Error(`WHEP request failed with status ${response.status}`);
            }

            const answerSdp = await response.text();
            await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });

            if (isActive) {
                updateState("playing");
            }
        };

        start().catch((error) => {
            if (!isActive) return;
            updateState("error");
            if (onError) {
                onError(error);
            }
        });

        return () => {
            isActive = false;
            abortController.abort();
            cleanupVideo();
            if (peerConnection) {
                peerConnection.getSenders().forEach((sender) => sender.track?.stop());
                peerConnection.getReceivers().forEach((receiver) => receiver.track?.stop());
                peerConnection.close();
            }
        };
    }, [onError, onStateChange, whepUrl]);

    return <video ref={videoRef} className={className} autoPlay playsInline muted />;
}
