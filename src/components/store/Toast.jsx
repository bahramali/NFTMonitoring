import React, { useEffect } from 'react';
import styles from './Toast.module.css';

const TYPE_STYLES = {
    success: styles.success,
    error: styles.error,
    warning: styles.warning,
    info: styles.info,
};

export default function Toast({ toast, onDismiss }) {
    useEffect(() => {
        if (!toast) return undefined;
        const id = window.setTimeout(() => onDismiss?.(), 3600);
        return () => window.clearTimeout(id);
    }, [onDismiss, toast]);

    if (!toast) return null;
    const tone = TYPE_STYLES[toast.type] || styles.info;

    return (
        <div className={`${styles.toast} ${tone}`} role="status" aria-live="polite">
            <span>{toast.message}</span>
            <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
                ×
            </button>
        </div>
    );
}
