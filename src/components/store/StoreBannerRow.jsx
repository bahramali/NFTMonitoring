import React from 'react';
import { Link } from 'react-router-dom';
import styles from './StoreBannerRow.module.css';

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

function BannerCard({ banner }) {
    const title = banner?.title?.trim() || '';
    const description = banner?.description?.trim() || banner?.subtitle?.trim() || '';
    const imageUrl = banner?.imageUrl?.trim() || '';
    const buttonText = banner?.buttonText?.trim() || '';
    const buttonUrl = banner?.buttonUrl?.trim() || '';
    const resolvedButton = resolveUrl(buttonUrl);

    return (
        <article className={styles.card}>
            {imageUrl ? <img src={imageUrl} alt={title || 'Banner'} className={styles.image} loading="lazy" /> : null}
            <div className={styles.body}>
                {title ? <h3>{title}</h3> : null}
                {description ? <p>{description}</p> : null}
                {buttonText && buttonUrl ? (
                    resolvedButton.external
                        ? <a href={resolvedButton.href} target="_blank" rel="noreferrer">{buttonText}</a>
                        : <Link to={resolvedButton.href}>{buttonText}</Link>
                ) : null}
            </div>
        </article>
    );
}

export default function StoreBannerRow({ banners = [] }) {
    if (!Array.isArray(banners) || banners.length === 0) return null;

    return (
        <section className={styles.section} aria-label="Store highlights">
            <div className={styles.header}>
                <p>Highlights</p>
                <h2>What&apos;s new at HydroLeaf</h2>
            </div>
            <div className={styles.grid}>
                {banners.map((banner) => (
                    <BannerCard key={banner.id || `${banner.title}-${banner.position}`} banner={banner} />
                ))}
            </div>
        </section>
    );
}
