import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import usePasswordReset from '../../hooks/usePasswordReset.js';
import styles from './CustomerSecurity.module.css';

export default function CustomerSecurity() {
    const { token } = useAuth();
    const { profile } = useOutletContext();
    const { resetState, resetError, resetDisabled, handlePasswordReset } = usePasswordReset({ token });

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div>
                    <p className={styles.kicker}>Security</p>
                    <h2>Password & security</h2>
                    <p className={styles.subtitle}>Manage password resets and account safety.</p>
                </div>
                <Link to="/account" className={styles.secondaryButton}>
                    Back to overview
                </Link>
            </div>

            <div className={styles.section}>
                <div>
                    <h3>Reset password</h3>
                    <p className={styles.helper}>
                        We’ll email a secure reset link to {profile?.email || 'your verified email'}.
                    </p>
                </div>
                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handlePasswordReset}
                    disabled={resetDisabled}
                >
                    {resetState.status === 'sending' ? 'Sending…' : 'Send reset link'}
                </button>
            </div>

            {resetState.status === 'sent' ? <p className={styles.successMessage}>{resetState.message}</p> : null}
            {resetError ? <p className={styles.errorMessage}>{resetError}</p> : null}
        </div>
    );
}
