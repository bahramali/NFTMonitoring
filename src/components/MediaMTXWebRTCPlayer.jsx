import React, { useEffect, useRef } from "react";
import MediaMTXWebRTCReader from "../utils/MediaMTXWebRTCReader.js";

export default function MediaMTXWebRTCPlayer({
    whepUrl,
    videoClassName = "",
    wrapperClassName = "",
    videoRef: externalVideoRef,
    onStatusChange,
    onError,
}) {
    const localVideoRef = useRef(null);
    const videoRef = externalVideoRef || localVideoRef;
    const onStatusChangeRef = useRef(onStatusChange);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onStatusChangeRef.current = onStatusChange;
    }, [onStatusChange]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    const updateStatus = (nextStatus) => {
        onStatusChangeRef.current?.(nextStatus);
    };

    const reportError = (message) => {
        onErrorRef.current?.(message);
        updateStatus("error");
    };

    useEffect(() => {
        const videoElement = videoRef.current;
        if (!whepUrl) {
            reportError("Missing WHEP endpoint for the selected camera.");
            return undefined;
        }
        if (!videoElement) {
            reportError("Unable to load the camera stream.");
            return undefined;
        }

        updateStatus("loading");
        const reader = new MediaMTXWebRTCReader({
            url: whepUrl,
            video: videoElement,
            onStatusChange: updateStatus,
            onError: reportError,
        });

        reader.start().catch((error) => {
            if (error?.name === "AbortError") {
                return;
            }
            reportError(error?.message || "Unable to load the camera stream.");
        });

        return () => {
            reader.stop();
        };
    }, [whepUrl, videoRef]);

    return (
        <div className={wrapperClassName}>
            <video
                ref={videoRef}
                className={videoClassName}
                autoPlay
                playsInline
                muted
            />
        </div>
    );
}
