import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';
import { getDefaultRouteForRole } from '../utils/roleRoutes.js';

export default function Login() {
    const { isAuthenticated, login, role } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const returnUrl = useMemo(() => {
        const value = new URLSearchParams(location.search).get('returnUrl');
        if (!value || !value.startsWith('/')) {
            return null;
        }
        return value;
    }, [location.search]);

    useEffect(() => {
        if (isAuthenticated) {
            const target = returnUrl || getDefaultRouteForRole(role);
            navigate(target, { replace: true });
        }
    }, [isAuthenticated, navigate, returnUrl, role]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const result = await login(email, password);
        if (!result.success) {
            setError(result.message || 'Login failed. Please verify your credentials.');
            return;
        }

        const resolvedRole = result.role || role;
        const roleRedirect = getDefaultRouteForRole(resolvedRole);
        const redirect = returnUrl || location.state?.from?.pathname || roleRedirect;
        navigate(redirect, { replace: true });
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Sign in</h1>
                <p className={styles.subtitle}>
                    Enter your email and password. We&apos;ll call the login API, store your session securely, and
                    redirect you to the right dashboard for your role.
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
                    />

                    <label className={styles.label} htmlFor="password">
                        Password
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
                    <li>Admins only see the pages the backend permissions allow.</li>
                    <li>Workers always see Home and Worker Dashboard.</li>
                    <li>Customers can always reach Home and My Page.</li>
                </ul>
            </div>
        </div>
    );
}
