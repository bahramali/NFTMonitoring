// pages/Cameras/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Cameras.module.css";
import PageHeader from "../../components/PageHeader.jsx";
import MediaMTXWebRTCReader from "../../components/MediaMTXWebRTCReader.jsx";

const CAMERA_PATHS = ["s01l01", "S2L1", "S2L2", "S2L3", "S2L4"];

const getIframeUrl = (path) => `https://cam.hydroleaf.se:8443/${path}/`;
const getWhepUrl = (path) => `https://cam.hydroleaf.se:8443/${path}/whep`;

const MODE_OPTIONS = [
    { value: "iframe", label: "iframe mode" },
    { value: "webrtc", label: "native WebRTC" },
];

export default function Cameras() {
    const [selectedPath, setSelectedPath] = useState(CAMERA_PATHS[0]);
    const [mode, setMode] = useState("iframe");
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const iframeTimeoutRef = useRef(null);

    const iframeUrl = useMemo(() => getIframeUrl(selectedPath), [selectedPath]);
    const whepUrl = useMemo(() => getWhepUrl(selectedPath), [selectedPath]);

    useEffect(() => {
        setErrorMessage("");
        setIsLoading(true);

        if (iframeTimeoutRef.current) {
            clearTimeout(iframeTimeoutRef.current);
            iframeTimeoutRef.current = null;
        }

        if (mode === "iframe") {
            iframeTimeoutRef.current = setTimeout(() => {
                setErrorMessage("Timed out while loading the iframe stream.");
                setIsLoading(false);
            }, 12000);
        }

        return () => {
            if (iframeTimeoutRef.current) {
                clearTimeout(iframeTimeoutRef.current);
                iframeTimeoutRef.current = null;
            }
        };
    }, [mode, selectedPath]);

    useEffect(() => {
        return () => {
            if (iframeTimeoutRef.current) {
                clearTimeout(iframeTimeoutRef.current);
            }
        };
    }, []);

    const handleIframeLoad = () => {
        if (iframeTimeoutRef.current) {
            clearTimeout(iframeTimeoutRef.current);
            iframeTimeoutRef.current = null;
        }
        setIsLoading(false);
        setErrorMessage("");
    };

    const handleIframeError = () => {
        if (iframeTimeoutRef.current) {
            clearTimeout(iframeTimeoutRef.current);
            iframeTimeoutRef.current = null;
        }
        setIsLoading(false);
        setErrorMessage("Failed to load the iframe stream.");
    };

    const handleReaderStateChange = (state) => {
        if (state === "loading") {
            setIsLoading(true);
        }
        if (state === "playing") {
            setIsLoading(false);
        }
        if (state === "error") {
            setIsLoading(false);
        }
    };

    const handleReaderError = (error) => {
        setErrorMessage(error?.message || String(error));
    };

    return (
        <div className={styles.page}>
            <div className={styles.layout}>
                <PageHeader
                    breadcrumbItems={[
                        { label: "Monitoring", to: "/monitoring" },
                        { label: "Cameras", to: "/monitoring/cameras" },
                    ]}
                    title="MediaMTX Cameras"
                    variant="dark"
                />

                <section className={styles.controls}>
                    <div className={styles.controlGroup}>
                        <label className={styles.controlLabel} htmlFor="camera-path">
                            Camera path
                        </label>
                        <select
                            id="camera-path"
                            className={styles.select}
                            value={selectedPath}
                            onChange={(event) => setSelectedPath(event.target.value)}
                        >
                            {CAMERA_PATHS.map((path) => (
                                <option key={path} value={path}>
                                    {path}
                                </option>
                            ))}
                        </select>
                    </div>
                    <fieldset className={styles.modeGroup}>
                        <legend className={styles.controlLabel}>Mode</legend>
                        <div className={styles.modeOptions}>
                            {MODE_OPTIONS.map((option) => (
                                <label key={option.value} className={styles.modeOption}>
                                    <input
                                        type="radio"
                                        name="stream-mode"
                                        value={option.value}
                                        checked={mode === option.value}
                                        onChange={(event) => setMode(event.target.value)}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                </section>

                <section className={styles.playerCard}>
                    <div className={styles.playerHeader}>
                        <div>
                            <h2 className={styles.playerTitle}>Stream preview</h2>
                            <p className={styles.playerSubtitle}>{selectedPath}</p>
                        </div>
                        <div className={styles.status}>
                            {isLoading && <span className={styles.statusLoading}>Loading…</span>}
                            {!isLoading && errorMessage && (
                                <span className={styles.statusError}>Error: {errorMessage}</span>
                            )}
                            {!isLoading && !errorMessage && (
                                <span className={styles.statusOk}>Live</span>
                            )}
                        </div>
                    </div>
                    <div className={styles.playerArea}>
                        {mode === "iframe" ? (
                            <iframe
                                key={selectedPath}
                                title={`Camera ${selectedPath}`}
                                src={iframeUrl}
                                className={styles.iframe}
                                onLoad={handleIframeLoad}
                                onError={handleIframeError}
                                allow="autoplay; fullscreen"
                            />
                        ) : (
                            <MediaMTXWebRTCReader
                                whepUrl={whepUrl}
                                onStateChange={handleReaderStateChange}
                                onError={handleReaderError}
                                className={styles.video}
                            />
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
