import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/auth.js';
import { isValidEmail } from '../utils/validation.js';
import styles from './ForgotPassword.module.css';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [loading, setLoading] = useState(false);

    const resolveErrorMessage = (errorResponse) => {
        const message = `${errorResponse?.payload?.message || errorResponse?.message || ''}`.toLowerCase();
        if (errorResponse?.status === 404 || message.includes('not found')) {
            return 'We could not find an account with that email address.';
        }
        return errorResponse?.payload?.message || errorResponse?.message || 'Unable to send reset link.';
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitted || loading) return;
        const trimmedEmail = email.trim();

        setSubmitError('');
        if (!trimmedEmail) {
            setEmailError('Email address is required.');
            return;
        }

        if (!isValidEmail(trimmedEmail)) {
            setEmailError('Please enter a valid email address.');
            return;
        }

        setEmailError('');
        setLoading(true);
        try {
            await requestPasswordReset({ email: trimmedEmail });
            setSubmitted(true);
        } catch (errorResponse) {
            setSubmitError(resolveErrorMessage(errorResponse));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Forgot your password?</h1>
                <p className={styles.subtitle}>
                    Enter the email address associated with your account and we will send you a reset link.
                </p>

                {submitted && (
                    <div className={`${styles.notice} ${styles.noticeSuccess}`}>
                        If this email is registered, we’ll send you a reset link.
                    </div>
                )}

                {submitError && <div className={`${styles.notice} ${styles.noticeError}`}>{submitError}</div>}

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label} htmlFor="email">
                        Email address
                    </label>
                    <input
                        id="email"
                        className={`${styles.input} ${emailError ? styles.inputError : ''}`}
                        type="email"
                        value={email}
                        onChange={(event) => {
                            setEmail(event.target.value);
                            if (emailError) setEmailError('');
                            if (submitError) setSubmitError('');
                        }}
                        required
                        autoComplete="email"
                        disabled={submitted || loading}
                        aria-invalid={Boolean(emailError)}
                        aria-describedby={emailError ? 'email-error' : undefined}
                    />
                    {emailError && (
                        <span className={styles.fieldError} id="email-error" role="alert">
                            {emailError}
                        </span>
                    )}

                    <button className={styles.button} type="submit" disabled={submitted || loading}>
                        {submitted ? 'Email sent' : loading ? 'Sending…' : 'Send reset link'}
                    </button>
                </form>

                <p className={styles.linkRow}>
                    Remembered your password?
                    {' '}
                    <Link className={styles.link} to="/login">Back to sign in</Link>
                </p>
            </div>
        </div>
    );
}
