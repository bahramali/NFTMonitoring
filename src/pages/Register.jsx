import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';

const DEFAULT_ROUTE = '/my-page';

export default function Register() {
    const { isAuthenticated, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const passwordRequirement = 'Password must be at least 8 characters long.';

    useEffect(() => {
        if (isAuthenticated) {
            const redirect = location.state?.from?.pathname || DEFAULT_ROUTE;
            navigate(redirect, { replace: true });
        }
    }, [isAuthenticated, location.state?.from?.pathname, navigate]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const trimmedPassword = password.trim();
        const trimmedConfirmPassword = confirmPassword.trim();

        if (!trimmedPassword) {
            setError('Password is required.');
            return;
        }

        if (trimmedPassword.length < 8) {
            setError(passwordRequirement);
            return;
        }

        if (trimmedPassword !== trimmedConfirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const result = await register(email, trimmedPassword);
        if (result.success) {
            setError('');
            navigate(DEFAULT_ROUTE, { replace: true });
        } else {
            setError(result.message || 'Unable to register. Please try again.');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Create a customer account</h1>
                <p className={styles.subtitle}>
                    Register with your email and password to access your customer page. You&apos;ll be logged in as soon as
                    your account is created.
                </p>
                <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
                    <label className={styles.label} htmlFor="email">Email</label>
                    <input
                        id="email"
                        className={styles.input}
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                    />

                    <label className={styles.label} htmlFor="password">
                        Password
                        <span className={styles.labelHint}>(min. 8 characters)</span>
                    </label>
                    <input
                        id="password"
                        className={styles.input}
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        autoComplete="new-password"
                    />

                    <label className={styles.label} htmlFor="confirm-password">Confirm password</label>
                    <input
                        id="confirm-password"
                        className={styles.input}
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        autoComplete="new-password"
                    />

                    {error && <div className={styles.error}>{error}</div>}

                    <button className={styles.button} type="submit">Register</button>
                    <p className={styles.linkRow}>
                        Already have an account?
                        {' '}
                        <Link to="/login">Back to login</Link>
                    </p>
                </form>
            </div>
            <div className={styles.helper}>
                <h2>Why register?</h2>
                <ul>
                    <li>Create a dedicated customer space.</li>
                    <li>Save your preferences securely.</li>
                    <li>Access My Page without selecting roles manually.</li>
                </ul>
            </div>
        </div>
    );
}
