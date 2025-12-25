import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { fetchCustomerProfile, fetchMyOrders } from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { normalizeOrderList } from './orderUtils.js';
import styles from './CustomerLayout.module.css';

const normalizeProfile = (payload) => {
    const source = payload?.user ?? payload ?? {};
    const email = source.email ?? source.username ?? '';
    const displayName =
        (source.displayName ?? source.name ?? source.fullName ?? source.nickname ?? email) || 'Customer';

    return {
        id: source.id ?? source.userId ?? null,
        email,
        displayName,
        role: source.role ?? 'CUSTOMER',
        raw: source,
        features: source.features ?? source.capabilities ?? [],
    };
};

export default function CustomerLayout() {
    const { token } = useAuth();
    const redirectToLogin = useRedirectToLogin();

    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [ordersState, setOrdersState] = useState({
        supported: null,
        items: [],
        loading: false,
        error: null,
        lastFetched: null,
    });

    const loadProfile = useCallback(
        async (signal) => {
            if (!token) return;
            setLoadingProfile(true);
            setProfileError(null);
            try {
                const payload = await fetchCustomerProfile(token, { signal, onUnauthorized: redirectToLogin });
                if (!payload) return;
                setProfile(normalizeProfile(payload));
            } catch (error) {
                if (error?.name === 'AbortError') return;
                setProfileError(error?.message || 'Failed to load profile');
            } finally {
                setLoadingProfile(false);
            }
        },
        [redirectToLogin, token],
    );

    useEffect(() => {
        const controller = new AbortController();
        loadProfile(controller.signal);
        return () => controller.abort();
    }, [loadProfile]);

    const loadOrders = useCallback(
        async ({ silent = false, signal } = {}) => {
            if (!token) return [];
            setOrdersState((previous) => ({ ...previous, loading: true, error: silent ? previous.error : null }));

            try {
                const payload = await fetchMyOrders(token, { signal, onUnauthorized: redirectToLogin });
                if (payload === null) {
                    setOrdersState((previous) => ({ ...previous, loading: false }));
                    return [];
                }
                const normalized = normalizeOrderList(payload);
                setOrdersState({
                    supported: true,
                    items: normalized,
                    loading: false,
                    error: null,
                    lastFetched: Date.now(),
                });
                return normalized;
            } catch (error) {
                if (error?.name === 'AbortError') {
                    setOrdersState((previous) => ({ ...previous, loading: false }));
                    return [];
                }
                if (error?.isUnsupported) {
                    setOrdersState({
                        supported: false,
                        items: [],
                        loading: false,
                        error: null,
                        lastFetched: Date.now(),
                    });
                    return [];
                }
                setOrdersState((previous) => ({
                    ...previous,
                    loading: false,
                    error: silent ? previous.error : error?.message || 'Failed to load orders',
                }));
                return [];
            }
        },
        [redirectToLogin, token],
    );

    const contextValue = useMemo(
        () => ({
            profile,
            profileError,
            loadingProfile,
            refreshProfile: () => loadProfile(),
            redirectToLogin,
            ordersState,
            loadOrders,
        }),
        [loadOrders, loadingProfile, ordersState, profile, profileError, redirectToLogin],
    );

    const headline = 'My Account';
    const subhead = 'Manage your account details and orders in one place.';

    return (
        <div className={styles.page}>
            <div className={styles.hero}>
                <div>
                    <h1 className={styles.title}>{headline}</h1>
                    <p className={styles.subtitle}>{subhead}</p>
                </div>
            </div>

            {profileError && (
                <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
                    <div>
                        <strong>Failed to load account</strong>
                        <div>{profileError}</div>
                    </div>
                    <button type="button" className={styles.bannerAction} onClick={() => loadProfile()}>
                        Retry
                    </button>
                </div>
            )}

            <div className={styles.content}>
                <Outlet context={contextValue} />
            </div>
        </div>
    );
}
