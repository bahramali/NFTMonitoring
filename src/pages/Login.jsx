import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';

const ROLE_ROUTES = {
    SUPER_ADMIN: '/super-admin',
    ADMIN: '/admin',
    WORKER: '/worker/dashboard',
    CUSTOMER: '/my-page',
};

export default function Login() {
    const { isAuthenticated, login, role } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            const target = ROLE_ROUTES[role] || '/';
            navigate(target, { replace: true });
        }
    }, [isAuthenticated, navigate, role]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const result = await login(username, password);
        if (!result.success) {
            setError(result.message || 'Login failed. Please verify your credentials.');
            return;
        }

        const resolvedRole = result.role || role;
        const roleRedirect = ROLE_ROUTES[resolvedRole] || '/';
        const redirect = location.state?.from?.pathname || roleRedirect;
        navigate(redirect, { replace: true });
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Sign in</h1>
                <p className={styles.subtitle}>
                    Enter your username and password. We&apos;ll call the login API, store your session securely, and
                    redirect you to the right dashboard for your role.
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
                    />

                    <label className={styles.label} htmlFor="password">
                        Password
                        <span className={styles.labelHint}>(required for super admin)</span>
                    </label>
                    <input
                        id="password"
                        className={styles.input}
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />

                    {error && <div className={styles.error}>{error}</div>}

                    <button className={styles.button} type="submit">Sign in</button>
                    <p className={styles.linkRow}>
                        New customer?
                        {' '}
                        <Link to="/register">Create an account</Link>
                    </p>
                </form>
            </div>
            <div className={styles.helper}>
                <h2>Quick rules</h2>
                <ul>
                    <li>Admins inherit only the pages the super admin assigns.</li>
                    <li>Workers always see Home and Worker Dashboard.</li>
                    <li>Customers can always reach Home and My Page.</li>
                </ul>
            </div>
        </div>
    );
}
