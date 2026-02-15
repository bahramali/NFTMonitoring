import React from 'react';
import { Link } from 'react-router-dom';
import styles from './StoreHeroBanner.module.css';

const resolveUrl = (url = '') => {
    if (!url) return { external: false, href: '' };

    if (!/^https?:\/\//i.test(url)) {
        return { external: false, href: url };
    }

    if (typeof window === 'undefined') {
        return { external: true, href: url };
    }

    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) {
        return { external: false, href: `${parsed.pathname}${parsed.search}${parsed.hash}` };
    }

    return { external: true, href: url };
};

export default function StoreHeroBanner({ banner }) {
    if (!banner) return null;

    const title = banner?.title?.trim() || 'HydroLeaf Store';
    const subtitle = banner?.subtitle?.trim() || banner?.description?.trim() || '';
    const imageUrl = banner?.imageUrl?.trim() || '';
    const buttonText = banner?.buttonText?.trim() || '';
    const buttonUrl = banner?.buttonUrl?.trim() || '';
    const resolvedButton = resolveUrl(buttonUrl);

    return (
        <section
            className={styles.hero}
            style={imageUrl ? { '--hero-image': `url(${imageUrl})` } : undefined}
            aria-label="Store spotlight"
        >
            <div className={styles.overlay} />
            <div className={styles.content}>
                <p className={styles.kicker}>HydroLeaf Store</p>
                <h1>{title}</h1>
                {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
                {buttonText && buttonUrl ? (
                    resolvedButton.external ? (
                        <a href={resolvedButton.href} target="_blank" rel="noreferrer" className={styles.cta}>
                            {buttonText}
                        </a>
                    ) : (
                        <Link to={resolvedButton.href} className={styles.cta}>{buttonText}</Link>
                    )
                ) : null}
            </div>
        </section>
    );
}
