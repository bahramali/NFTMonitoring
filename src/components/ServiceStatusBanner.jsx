import React from 'react';
import styles from './ServiceStatusBanner.module.css';

const isBannerEnabled = () => {
    const flag = import.meta.env?.VITE_SHOW_SERVICE_BANNER;
    return flag !== 'false';
};

export default function ServiceStatusBanner() {
    if (!isBannerEnabled()) {
        return null;
    }

    return (
        <div className={styles.banner} role="status" aria-live="polite">
            <div className={styles.title}>اطلاعیه</div>
            <div className={styles.message}>
                اپلیکیشن در حال به‌روزرسانی است و بابت اختلال در ارائه سرویس پوزش می‌خواهیم.
            </div>
        </div>
    );
}
