import React from 'react';
import styles from './OAuthButton.module.css';

const providerLabels = {
    google: 'Continue with Google',
};

const GoogleIcon = () => (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path
            fill="#EA4335"
            d="M24 9.5c3.5 0 6.3 1.5 8.2 3.2l6.1-6.1C34.7 3.1 29.8 1 24 1 14.6 1 6.5 6.5 2.7 14.5l7.4 5.7C11.9 13.8 17.5 9.5 24 9.5z"
        />
        <path
            fill="#4285F4"
            d="M46.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.4h12.6c-.3 2-1.8 5-5 7.1l7.7 5.9c4.5-4.1 7.1-10.1 7.1-16.5z"
        />
        <path
            fill="#FBBC05"
            d="M10.1 28.1c-.5-1.5-.9-3-.9-4.6s.3-3.1.8-4.6l-7.4-5.7C1 16.1 0 20.9 0 24.5c0 3.6 1 8.4 2.6 11.3l7.5-5.7z"
        />
        <path
            fill="#34A853"
            d="M24 47c6.5 0 12-2.1 16-5.7l-7.7-5.9c-2.1 1.4-4.9 2.4-8.3 2.4-6.5 0-12-4.3-14-10.4l-7.5 5.7C6.4 41.4 14.6 47 24 47z"
        />
    </svg>
);

const providerIcons = {
    google: GoogleIcon,
};

export default function OAuthButton({
    provider,
    label,
    onClick,
    disabled = false,
    loading = false,
}) {
    const providerKey = provider?.toLowerCase();
    const resolvedLabel = label || providerLabels[providerKey] || 'Continue';
    const Icon = providerIcons[providerKey] || null;

    return (
        <button
            type="button"
            className={`${styles.button} ${providerKey ? styles[providerKey] : ''}`}
            onClick={onClick}
            disabled={disabled || loading}
        >
            <span className={styles.icon} aria-hidden="true">
                {Icon ? <Icon /> : null}
            </span>
            <span className={styles.text}>{loading ? 'Connecting…' : resolvedLabel}</span>
        </button>
    );
}
