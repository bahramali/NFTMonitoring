import React from 'react';
import styles from './DocumentActions.module.css';

function ActionButton({ label, helper, disabled, reason, loading, onClick }) {
    return (
        <div className={styles.actionItem}>
            <button type="button" className={styles.button} disabled={disabled || loading} onClick={onClick} title={disabled ? reason : ''}>
                {loading ? 'Working…' : label}
            </button>
            <small>{disabled ? reason : helper}</small>
        </div>
    );
}

export default function DocumentActions({ actions, error, onRetry }) {
    return (
        <div className={styles.wrap}>
            {actions.map((action) => (
                <ActionButton key={action.key} {...action} />
            ))}
            {error ? (
                <div className={styles.errorBanner} role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={onRetry}>Retry</button>
                </div>
            ) : null}
        </div>
    );
}
