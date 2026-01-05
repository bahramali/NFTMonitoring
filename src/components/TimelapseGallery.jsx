import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TimelapseGallery.module.css';

const CAMERAS = [
    { id: 'tapo-59', title: 'Tapo 59', src: '/videos/tapo-59/latest.mp4' },
    { id: 'tapo-38', title: 'Tapo 38', src: '/videos/tapo-38/latest.mp4' },
    { id: 'tapo-39', title: 'Tapo 39', src: '/videos/tapo-39/latest.mp4' },
    { id: 'tapo-40', title: 'Tapo 40', src: '/videos/tapo-40/latest.mp4' },
    { id: 'tapo-35', title: 'Tapo 35', src: '/videos/tapo-35/latest.mp4' },
    { id: 'tapo-37', title: 'Tapo 37', src: '/videos/tapo-37/latest.mp4' },
];

function TimelapseCard({ camera }) {
    const wrapperRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [cacheBust, setCacheBust] = useState(0);

    const currentSrc = useMemo(() => {
        if (!isVisible) {
            return '';
        }
        if (cacheBust) {
            return `${camera.src}?v=${cacheBust}`;
        }
        return camera.src;
    }, [camera.src, cacheBust, isVisible]);

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
                        src={currentSrc}
                        className={styles.video}
                        controls
                        muted
                        preload="metadata"
                        playsInline
                        onError={() => setHasError(true)}
                    />
                ) : (
                    <div className={styles.videoPlaceholder} aria-hidden="true" />
                )}
            </div>
            {hasError && (
                <p className={styles.errorMessage}>Timelapse unavailable</p>
            )}
        </article>
    );
}

export default function TimelapseGallery() {
    return (
        <section className={styles.section}>
            <div className={styles.sectionHeader}>
                <div>
                    <h2 className={styles.sectionTitle}>Timelapse</h2>
                    <p className={styles.sectionNote}>Latest hourly timelapse (updates automatically).</p>
                </div>
            </div>
            <div className={styles.grid}>
                {CAMERAS.map((camera) => (
                    <TimelapseCard key={camera.id} camera={camera} />
                ))}
            </div>
        </section>
    );
}
