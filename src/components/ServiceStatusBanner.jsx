import React from 'react';
import styles from './ServiceStatusBanner.module.css';

const isBannerEnabled = () => {
    const flag = import.meta.env?.VITE_SHOW_SERVICE_BANNER;
    return flag === 'true';
};

export default function ServiceStatusBanner() {
    if (!isBannerEnabled()) {
        return null;
    }

    return (
        <div className={styles.banner} role="status" aria-live="polite">
            <div className={styles.title}>Notice</div>
            <div className={styles.message}>
                The application is currently being updated, and we apologize for any service disruption.
            </div>
        </div>
    );
}
