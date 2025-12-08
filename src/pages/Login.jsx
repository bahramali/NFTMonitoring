import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';

export default function Login() {
    const { isAuthenticated, login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/overview', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = (event) => {
        event.preventDefault();
        const trimmedUsername = username.trim();
        const result = login(trimmedUsername, password);

        if (result.success) {
            navigate('/overview', { replace: true });
        } else {
            setError('Incorrect username or password.');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Sign in</h1>
                <p className={styles.subtitle}>Enter the admin credentials to access the dashboard.</p>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label} htmlFor="username">Username</label>
                    <input
                        id="username"
                        className={styles.input}
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                    />
                    <label className={styles.label} htmlFor="password">Password</label>
                    <input
                        id="password"
                        className={styles.input}
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                    {error && <div className={styles.error}>{error}</div>}
                    <button className={styles.button} type="submit">Log in</button>
                </form>
            </div>
        </div>
    );
}
