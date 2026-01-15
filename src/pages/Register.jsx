import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '../utils/validation.js';

const DEFAULT_ROUTE = '/my-page';

export default function Register() {
    const { isAuthenticated, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const passwordRequirement = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;

    useEffect(() => {
        if (isAuthenticated) {
            const redirect = location.state?.from?.pathname || DEFAULT_ROUTE;
            navigate(redirect, { replace: true });
        }
    }, [isAuthenticated, location.state?.from?.pathname, navigate]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();
        const trimmedConfirmPassword = confirmPassword.trim();

        const nextErrors = {};
        if (!trimmedEmail) {
            nextErrors.email = 'Email is required.';
        } else if (!isValidEmail(trimmedEmail)) {
            nextErrors.email = 'Enter a valid email address.';
        }

        if (!trimmedPassword) {
            nextErrors.password = 'Password is required.';
        } else if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
            nextErrors.password = passwordRequirement;
        }

        if (trimmedPassword !== trimmedConfirmPassword) {
            nextErrors.confirmPassword = 'Passwords do not match.';
        }

        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            return;
        }

        if (Object.keys(fieldErrors).length > 0) {
            setFieldErrors({});
        }

        const result = await register(trimmedEmail, trimmedPassword);
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
                        className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                        type="email"
                        value={email}
                        onChange={(event) => {
                            setEmail(event.target.value);
                            if (fieldErrors.email) {
                                setFieldErrors((prev) => ({ ...prev, email: '' }));
                            }
                            if (error) setError('');
                        }}
                        required
                        autoComplete="email"
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                    />
                    {fieldErrors.email && (
                        <span className={styles.fieldError} id="register-email-error" role="alert">
                            {fieldErrors.email}
                        </span>
                    )}

                    <label className={styles.label} htmlFor="password">
                        Password
                        <span className={styles.labelHint}>(min. 8 characters)</span>
                    </label>
                    <input
                        id="password"
                        className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                        type="password"
                        value={password}
                        onChange={(event) => {
                            setPassword(event.target.value);
                            if (fieldErrors.password) {
                                setFieldErrors((prev) => ({ ...prev, password: '' }));
                            }
                            if (error) setError('');
                        }}
                        required
                        autoComplete="new-password"
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
                    />
                    {fieldErrors.password && (
                        <span className={styles.fieldError} id="register-password-error" role="alert">
                            {fieldErrors.password}
                        </span>
                    )}

                    <label className={styles.label} htmlFor="confirm-password">Confirm password</label>
                    <input
                        id="confirm-password"
                        className={`${styles.input} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => {
                            setConfirmPassword(event.target.value);
                            if (fieldErrors.confirmPassword) {
                                setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                            }
                            if (error) setError('');
                        }}
                        required
                        autoComplete="new-password"
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        aria-describedby={fieldErrors.confirmPassword ? 'register-confirm-error' : undefined}
                    />
                    {fieldErrors.confirmPassword && (
                        <span className={styles.fieldError} id="register-confirm-error" role="alert">
                            {fieldErrors.confirmPassword}
                        </span>
                    )}

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
