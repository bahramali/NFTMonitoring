import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset } from '../api/auth.js';
import styles from './ResetPassword.module.css';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState(token ? 'ready' : 'invalid');
    const [feedback, setFeedback] = useState(token ? '' : 'Reset token is missing.');

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (status !== 'ready') return;

        const trimmedPassword = password.trim();
        if (!trimmedPassword) {
            setFeedback('Password is required.');
            return;
        }

        if (trimmedPassword.length < 8) {
            setFeedback('Password must be at least 8 characters long.');
            return;
        }

        if (trimmedPassword !== confirmPassword.trim()) {
            setFeedback('Passwords do not match.');
            return;
        }

        setStatus('submitting');
        setFeedback('');

        try {
            await confirmPasswordReset(token, trimmedPassword);
            setStatus('success');
        } catch (error) {
            const message =
                error?.payload?.message
                || (error?.status === 400 ? 'Password must be at least 8 characters long.' : '')
                || error?.message
                || 'Could not reset password.';
            setFeedback(message);
            setStatus('ready');
        }
    };

    const renderNotice = () => {
        if (status === 'invalid') {
            return (
                <div className={`${styles.notice} ${styles.noticeError}`}>
                    {feedback || 'Invalid or expired link. Please request a new password reset.'}
                </div>
            );
        }

        if (status === 'success') {
            return (
                <div className={`${styles.notice} ${styles.noticeSuccess}`}>
                    Password reset successful. You can now <Link to="/login">sign in</Link> with your new password.
                </div>
            );
        }

        return null;
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Reset your password</h1>
                <p className={styles.subtitle}>
                    Enter a new password to regain access to your HydroLeaf account.
                </p>

                {renderNotice()}

                {(status === 'ready' || status === 'submitting') && (
                    <form className={styles.form} onSubmit={handleSubmit}>
                        <label className={styles.label} htmlFor="password">
                            New password
                            <span className={styles.labelHint}>(min. 8 characters)</span>
                        </label>
                        <input
                            id="password"
                            type="password"
                            className={styles.input}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            disabled={status === 'submitting'}
                            autoComplete="new-password"
                        />

                        <label className={styles.label} htmlFor="confirmPassword">
                            Confirm password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            className={styles.input}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            disabled={status === 'submitting'}
                            autoComplete="new-password"
                        />

                        {feedback && <div className={`${styles.notice} ${styles.noticeError}`}>{feedback}</div>}

                        <button type="submit" className={styles.button} disabled={status === 'submitting'}>
                            {status === 'submitting' ? 'Updating…' : 'Update password'}
                        </button>
                    </form>
                )}

                {status === 'success' && (
                    <div className={styles.helperText}>
                        If you requested this reset from a shared device, please ensure you sign out after logging in.
                    </div>
                )}
            </div>
        </div>
    );
}
