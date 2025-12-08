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
            setError('نام کاربری یا رمز عبور اشتباه است.');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>ورود</h1>
                <p className={styles.subtitle}>برای دسترسی به داشبورد لطفاً وارد شوید.</p>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label} htmlFor="username">نام کاربری</label>
                    <input
                        id="username"
                        className={styles.input}
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="Azad_admin"
                        required
                    />
                    <label className={styles.label} htmlFor="password">رمز عبور</label>
                    <input
                        id="password"
                        className={styles.input}
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Reza1!Reza1!"
                        required
                    />
                    {error && <div className={styles.error}>{error}</div>}
                    <button className={styles.button} type="submit">ورود به سامانه</button>
                </form>
            </div>
        </div>
    );
}
