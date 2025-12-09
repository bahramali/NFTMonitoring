import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';

const ROLE_ROUTES = {
    SUPER_ADMIN: '/super-admin',
    ADMIN: '/admin/dashboard',
    WORKER: '/worker',
    CUSTOMER: '/my-page',
};

export default function Login() {
    const { isAuthenticated, login, userRole } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('SUPER_ADMIN');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            const target = ROLE_ROUTES[userRole] || '/';
            navigate(target, { replace: true });
        }
    }, [isAuthenticated, navigate, userRole]);

    const handleSubmit = (event) => {
        event.preventDefault();
        const result = login(username, password, role);
        if (result.success) {
            const redirect = location.state?.from?.pathname || ROLE_ROUTES[role] || '/';
            navigate(redirect, { replace: true });
        } else {
            setError(result.message || 'Login failed. Please verify your credentials.');
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Sign in</h1>
                <p className={styles.subtitle}>
                    Use the selector to choose your role. Super admins need the password "superadmin".
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

                    <label className={styles.label} htmlFor="role">Role</label>
                    <select
                        id="role"
                        className={styles.input}
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                    >
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="WORKER">WORKER</option>
                        <option value="CUSTOMER">CUSTOMER</option>
                    </select>

                    {error && <div className={styles.error}>{error}</div>}

                    <button className={styles.button} type="submit">Sign in</button>
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
