import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';

const DEFAULT_ROUTE = '/my-page';

export default function Register() {
    const { isAuthenticated, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            const redirect = location.state?.from?.pathname || DEFAULT_ROUTE;
            navigate(redirect, { replace: true });
        }
    }, [isAuthenticated, location.state?.from?.pathname, navigate]);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const result = register(username, password);
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
                    Register with a username and password to access your customer page. You&apos;ll be logged in as soon as
                    your account is created.
                </p>
                <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
                    <label className={styles.label} htmlFor="username">Username</label>
                    <input
                        id="username"
                        className={styles.input}
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                        autoComplete="username"
                    />

                    <label className={styles.label} htmlFor="password">Password</label>
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
