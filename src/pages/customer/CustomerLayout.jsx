import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { fetchMyOrders } from '../../api/customer.js';
import Navbar from '../../components/Navbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { normalizeOrderList } from './orderUtils.js';
import styles from './CustomerLayout.module.css';

export default function CustomerLayout() {
    const { token, profile, profileError, loadingProfile, refreshProfile } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const location = useLocation();
    const [isSubnavOpen, setIsSubnavOpen] = useState(false);
    const [ordersState, setOrdersState] = useState({
        supported: null,
        items: [],
        loading: false,
        error: null,
        lastFetched: null,
    });

    useEffect(() => {
        setIsSubnavOpen(false);
    }, [location.pathname]);

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
            refreshProfile,
            redirectToLogin,
            ordersState,
            loadOrders,
        }),
        [loadOrders, loadingProfile, ordersState, profile, profileError, redirectToLogin],
    );

    const headline = 'My Account';
    const subhead = 'Manage your account details and orders in one place.';
    const navItems = [
        { to: '/account', label: 'Overview', end: true },
        { to: '/account/orders', label: 'Orders' },
        { to: '/account/addresses', label: 'Addresses' },
        { to: '/account/settings', label: 'Settings' },
        { to: '/account/security', label: 'Security' },
    ];
    const activeLabel =
        navItems.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))
            ?.label || 'Overview';

    return (
        <div className={styles.page}>
            <Navbar />
            <div className={styles.hero}>
                <div>
                    <h1 className={styles.title}>{headline}</h1>
                    <p className={styles.subtitle}>{subhead}</p>
                </div>
            </div>

            <div className={styles.subnav}>
                <div className={styles.subnavInner}>
                    <button
                        type="button"
                        className={styles.subnavToggle}
                        onClick={() => setIsSubnavOpen((prev) => !prev)}
                        aria-expanded={isSubnavOpen}
                    >
                        {activeLabel}
                        <span className={styles.subnavCaret} aria-hidden="true" />
                    </button>
                    <div className={`${styles.subnavList} ${isSubnavOpen ? styles.subnavListOpen : ''}`}>
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) =>
                                    `${styles.subnavLink} ${isActive ? styles.subnavLinkActive : ''}`
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </div>
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
