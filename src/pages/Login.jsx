import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';
import { getDefaultRouteForUser } from '../utils/roleRoutes.js';
import OAuthButton from '../components/OAuthButton.jsx';
import { fetchOAuthProviders, startGoogleSignIn } from '../api/auth.js';

export default function Login() {
    const { isAuthenticated, login, role, roles, permissions } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [oauthError, setOauthError] = useState('');
    const [oauthLoading, setOauthLoading] = useState(false);
    const [oauthProviders, setOauthProviders] = useState(null);

    const returnUrl = useMemo(() => {
        const value = new URLSearchParams(location.search).get('returnUrl');
        if (!value || !value.startsWith('/')) {
            return null;
        }
        return value;
    }, [location.search]);

    useEffect(() => {
        if (isAuthenticated) {
            const target = returnUrl || getDefaultRouteForUser({ role, roles, permissions });
            navigate(target, { replace: true });
        }
    }, [isAuthenticated, navigate, returnUrl, role, roles, permissions]);

    useEffect(() => {
        let isActive = true;
        const controller = new AbortController();

        fetchOAuthProviders({ signal: controller.signal })
            .then((providers) => {
                if (!isActive) return;
                setOauthProviders(providers);
            })
            .catch(() => {
                if (!isActive) return;
                setOauthProviders(null);
            });

        return () => {
            isActive = false;
            controller.abort();
        };
    }, []);

    const isGoogleAvailable = useMemo(() => {
        if (!oauthProviders) return true;
        if (!Array.isArray(oauthProviders)) return true;

        return oauthProviders.some((provider) => {
            if (!provider) return false;
            if (typeof provider === 'string') {
                return provider.toLowerCase() === 'google';
            }
            const raw =
                provider.id
                || provider.provider
                || provider.name
                || provider.slug
                || '';
            return typeof raw === 'string' && raw.toLowerCase() === 'google';
        });
    }, [oauthProviders]);

    const resolvedReturnUrl = returnUrl || location.state?.from?.pathname || null;

    const handleGoogleSignIn = async () => {
        setOauthError('');
        setOauthLoading(true);

        try {
            const redirectPath = resolvedReturnUrl && resolvedReturnUrl.startsWith('/')
                ? resolvedReturnUrl
                : '';
            const redirectUri = new URL(redirectPath, window.location.origin).toString();
            const response = await startGoogleSignIn({ redirectUri });

            const authorizationUrl =
                response?.authorizationUrl
                || response?.redirectUrl
                || response?.authorization_url
                || response?.url;
            if (!authorizationUrl) {
                throw new Error('Missing authorization URL.');
            }
            window.location.href = authorizationUrl;
        } catch (oauthErrorResponse) {
            const status = oauthErrorResponse?.status;
            if (status === 500) {
                setOauthError('Server error, try later');
            } else if (status === 401 || status === 403) {
                setOauthError('Not authorized');
            } else {
                setOauthError('Could not start Google sign-in. Try again.');
            }
            setOauthLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const result = await login(email, password);
        if (!result.success) {
            setError(result.message || 'Login failed. Please verify your credentials.');
            return;
        }

        const resolvedPermissions = result.permissions || permissions;
        const redirectTarget = getDefaultRouteForUser({
            role: result.role || role,
            roles,
            permissions: resolvedPermissions,
        });
        const redirect = returnUrl || location.state?.from?.pathname || redirectTarget;
        navigate(redirect, { replace: true });
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Sign in</h1>
                <p className={styles.subtitle}>
                    Choose a sign-in method to access your account securely and continue where you left off.
                </p>
                {isGoogleAvailable && (
                    <div className={styles.oauthSection}>
                        <OAuthButton
                            provider="google"
                            onClick={handleGoogleSignIn}
                            loading={oauthLoading}
                            disabled={oauthLoading}
                        />
                        {oauthError && <div className={styles.error}>{oauthError}</div>}
                        <div className={styles.divider}>
                            <span>Or sign in with email</span>
                        </div>
                    </div>
                )}
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
