import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './ForgotPassword.module.css';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (submitted) return;
        setSubmitted(true);
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

                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label} htmlFor="email">
                        Email address
                    </label>
                    <input
                        id="email"
                        className={styles.input}
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                        disabled={submitted}
                    />

                    <button className={styles.button} type="submit" disabled={submitted}>
                        {submitted ? 'Email sent' : 'Send reset link'}
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
