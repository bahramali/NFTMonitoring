import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getDefaultRouteForUser } from '../utils/roleRoutes.js';
import styles from './AuthCallback.module.css';
import { completeOAuthCallback } from '../api/auth.js';

export default function AuthCallback() {
    const { completeOAuthLogin, isAuthenticated, role, roles, permissions } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('Signing you in…');

    const returnUrl = useMemo(() => {
        const value = new URLSearchParams(location.search).get('returnUrl');
        if (!value || !value.startsWith('/')) {
            return null;
        }
        return value;
    }, [location.search]);

    const errorParam = useMemo(() => new URLSearchParams(location.search).get('error'), [location.search]);
    const codeParam = useMemo(() => new URLSearchParams(location.search).get('code'), [location.search]);
    const stateParam = useMemo(() => new URLSearchParams(location.search).get('state'), [location.search]);

    useEffect(() => {
        if (isAuthenticated) {
            const target = returnUrl || getDefaultRouteForUser({ role, roles, permissions });
            navigate(target, { replace: true });
        }
    }, [isAuthenticated, navigate, permissions, returnUrl, role, roles]);

    useEffect(() => {
        if (isAuthenticated) {
            return undefined;
        }

        if (errorParam) {
            setStatus('error');
            setMessage('Sign-in failed.');
            return undefined;
        }

        const controller = new AbortController();
        const completeLogin = async () => {
            setStatus('loading');
            setMessage('Signing you in…');
            if (codeParam && stateParam) {
                try {
                    await completeOAuthCallback('google', {
                        code: codeParam,
                        state: stateParam,
                        signal: controller.signal,
                    });
                } catch (callbackError) {
                    if (callbackError?.name === 'AbortError') {
                        return;
                    }
                    setStatus('error');
                    setMessage(callbackError?.message || 'Sign-in failed.');
                    return;
                }
            }
            const result = await completeOAuthLogin({ signal: controller.signal });
            if (!result.success) {
                setStatus('error');
                setMessage(result.message || 'Sign-in failed.');
                return;
            }

            const target = returnUrl || getDefaultRouteForUser({
                role: result.role || role,
                roles: result.roles || roles,
                permissions: result.permissions || permissions,
            });
            navigate(target, { replace: true });
        };

        completeLogin();

        return () => controller.abort();
    }, [
        codeParam,
        completeOAuthLogin,
        errorParam,
        isAuthenticated,
        navigate,
        permissions,
        returnUrl,
        role,
        roles,
        stateParam,
    ]);

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Google sign-in</h1>
                <p className={styles.message}>{message}</p>
                {status === 'error' && (
                    <div className={styles.actions}>
                        <Link className={styles.button} to={`/login${returnUrl ? `?returnUrl=${returnUrl}` : ''}`}>
                            Back to login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
