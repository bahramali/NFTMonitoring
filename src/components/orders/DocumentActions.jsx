import React from 'react';
import styles from './DocumentActions.module.css';

function ActionButton({ label, helper, disabled, reason, loading, onClick, variant = 'secondary' }) {
    return (
        <div className={styles.actionItem}>
            <button
                type="button"
                className={`${styles.button} ${styles[variant]}`}
                disabled={disabled || loading}
                onClick={onClick}
                title={disabled ? reason : ''}
            >
                {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
                <span>{loading ? 'Working…' : label}</span>
            </button>
            <small>{disabled ? reason : helper}</small>
        </div>
    );
}

export default function DocumentActions({ actions, error, warning, success, onRetry }) {
    return (
        <div className={styles.wrap}>
            <div className={styles.buttonGrid}>
                {actions.map((action) => (
                <ActionButton key={action.key} {...action} />
                ))}
            </div>
            {success ? <div className={`${styles.banner} ${styles.successBanner}`}>{success}</div> : null}
            {warning ? <div className={`${styles.banner} ${styles.warningBanner}`}>{warning}</div> : null}
            {error ? (
                <div className={`${styles.banner} ${styles.errorBanner}`} role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={onRetry}>Retry</button>
                </div>
            ) : null}
        </div>
    );
}
