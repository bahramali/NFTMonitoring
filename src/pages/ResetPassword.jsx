import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset } from '../api/auth.js';
import styles from './ResetPassword.module.css';
import { MIN_PASSWORD_LENGTH } from '../utils/validation.js';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState(token ? 'ready' : 'invalid');
    const [feedback, setFeedback] = useState(token ? '' : 'Reset token is missing.');
    const [fieldErrors, setFieldErrors] = useState({});

    const resolveTokenErrorMessage = (error) => {
        const message = `${error?.payload?.message || error?.message || ''}`.toLowerCase();
        if (
            error?.status === 401
            || error?.status === 403
            || error?.status === 404
            || message.includes('token')
            || message.includes('expired')
            || message.includes('invalid')
        ) {
            return 'Invalid or expired reset link. Please request a new one.';
        }
        return error?.payload?.message || error?.message || 'Could not reset password.';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (status !== 'ready') return;

        const trimmedPassword = password.trim();
        const trimmedConfirmPassword = confirmPassword.trim();
        const nextErrors = {};

        if (!trimmedPassword) {
            nextErrors.password = 'Password is required.';
        } else if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
            nextErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
        }

        if (trimmedPassword !== trimmedConfirmPassword) {
            nextErrors.confirmPassword = 'Passwords do not match.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            setFeedback('');
            return;
        }

        if (Object.keys(fieldErrors).length > 0) {
            setFieldErrors({});
        }

        setStatus('submitting');
        setFeedback('');

        try {
            await confirmPasswordReset(token, trimmedPassword);
            setStatus('success');
        } catch (error) {
            setFeedback(resolveTokenErrorMessage(error));
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
                            className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                if (fieldErrors.password) {
                                    setFieldErrors((prev) => ({ ...prev, password: '' }));
                                }
                                if (feedback) setFeedback('');
                            }}
                            disabled={status === 'submitting'}
                            autoComplete="new-password"
                            aria-invalid={Boolean(fieldErrors.password)}
                            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                        />
                        {fieldErrors.password && (
                            <span className={styles.fieldError} id="password-error" role="alert">
                                {fieldErrors.password}
                            </span>
                        )}

                        <label className={styles.label} htmlFor="confirmPassword">
                            Confirm password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            className={`${styles.input} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
                            value={confirmPassword}
                            onChange={(event) => {
                                setConfirmPassword(event.target.value);
                                if (fieldErrors.confirmPassword) {
                                    setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                                }
                                if (feedback) setFeedback('');
                            }}
                            disabled={status === 'submitting'}
                            autoComplete="new-password"
                            aria-invalid={Boolean(fieldErrors.confirmPassword)}
                            aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                        />
                        {fieldErrors.confirmPassword && (
                            <span className={styles.fieldError} id="confirm-password-error" role="alert">
                                {fieldErrors.confirmPassword}
                            </span>
                        )}

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
