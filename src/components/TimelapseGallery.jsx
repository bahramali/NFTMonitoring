import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TimelapseGallery.module.css';
import { CAMERA_CONFIG, getTimelapseBaseUrl } from '../config/cameras.js';

const TIMELAPSE_INDEX_ENDPOINT = '/api/timelapse/index';

const buildFallbackTimelapseList = () =>
    CAMERA_CONFIG.map((camera) => ({
        cameraId: camera.id,
        title: camera.name,
        latestMp4: `/${camera.id}/latest.mp4`,
    }));

function TimelapseCard({ camera, timelapseBaseUrl }) {
    const wrapperRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [cacheBust, setCacheBust] = useState(() => Date.now());

    const currentSrc = useMemo(() => {
        if (!isVisible) {
            return '';
        }
        const baseSrc = camera.latestMp4?.startsWith('http')
            ? camera.latestMp4
            : timelapseBaseUrl
                ? `${timelapseBaseUrl}${camera.latestMp4}`
                : '';
        if (!baseSrc) {
            return '';
        }
        return `${baseSrc}?v=${cacheBust}`;
    }, [camera.latestMp4, cacheBust, isVisible, timelapseBaseUrl]);

    useEffect(() => {
        if (!wrapperRef.current || isVisible) {
            return undefined;
        }

        if (typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return undefined;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsVisible(true);
                        observer.disconnect();
                    }
                });
            },
            { rootMargin: '100px' }
        );

        observer.observe(wrapperRef.current);

        return () => observer.disconnect();
    }, [isVisible]);

    const handleReload = () => {
        setHasError(false);
        setErrorMessage('');
        setCacheBust(Date.now());
    };

    return (
        <article className={styles.card} ref={wrapperRef}>
            <header className={styles.cardHeader}>
                <h3>{camera.title}</h3>
                <button type="button" onClick={handleReload} className={styles.reloadButton}>
                    Reload
                </button>
            </header>
            <div className={styles.videoFrame}>
                {currentSrc ? (
                    <video
                        key={currentSrc}
                        className={styles.video}
                        controls
                        muted
                        preload="metadata"
                        playsInline
                        onError={() => {
                            setHasError(true);
                            setErrorMessage('Timelapse not found yet.');
                        }}
                    >
                        <source src={currentSrc} type="video/mp4" />
                    </video>
                ) : (
                    <div className={styles.videoPlaceholder} aria-hidden="true" />
                )}
            </div>
            {hasError && (
                <p className={styles.errorMessage}>{errorMessage || 'Timelapse unavailable'}</p>
            )}
        </article>
    );
}

export default function TimelapseGallery() {
    const [timelapseList, setTimelapseList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const timelapseBaseUrl = getTimelapseBaseUrl();

    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        const fetchTimelapseIndex = async () => {
            setIsLoading(true);
            setLoadError('');
            try {
                const response = await fetch(TIMELAPSE_INDEX_ENDPOINT, {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`Timelapse index unavailable (${response.status})`);
                }
                const data = await response.json();
                const list = Array.isArray(data) ? data : data?.items || [];
                if (!mounted) return;
                setTimelapseList(list);
            } catch (error) {
                if (!mounted) return;
                console.warn('[TimelapseGallery] Falling back to default list.', error);
                setTimelapseList(buildFallbackTimelapseList());
                setLoadError('Using the default camera list.');
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchTimelapseIndex();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, []);

    const hasBaseUrl = Boolean(timelapseBaseUrl);
    const displayList = timelapseList.length > 0 ? timelapseList : buildFallbackTimelapseList();

    return (
        <section className={styles.section}>
            <div className={styles.sectionHeader}>
                <div>
                    <h2 className={styles.sectionTitle}>Timelapse</h2>
                    <p className={styles.sectionNote}>Latest hourly timelapse (auto-updates).</p>
                </div>
            </div>
            {!hasBaseUrl && (
                <p className={styles.errorMessage}>
                    Timelapse base URL is not configured. Set VITE_TIMELAPSE_BASE_URL to enable playback.
                </p>
            )}
            {isLoading && (
                <p className={styles.loadingMessage}>Loading timelapse list…</p>
            )}
            {loadError && (
                <p className={styles.helperMessage}>{loadError}</p>
            )}
            <div className={styles.grid}>
                {displayList.map((camera) => (
                    <TimelapseCard
                        key={camera.cameraId || camera.id}
                        camera={{
                            cameraId: camera.cameraId || camera.id,
                            latestMp4: camera.latestMp4 || `/${camera.cameraId || camera.id}/latest.mp4`,
                            title: camera.title || camera.name || camera.cameraId || camera.id,
                        }}
                        timelapseBaseUrl={timelapseBaseUrl}
                    />
                ))}
            </div>
        </section>
    );
}
