import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fetchCustomerAddresses } from '../../api/customerAddresses.js';
import { useAuth } from '../../context/AuthContext.jsx';
import usePasswordReset from '../../hooks/usePasswordReset.js';
import useOrderPaymentAction from '../../hooks/useOrderPaymentAction.js';
import { extractAddressList, formatAddressLine, normalizeAddress } from './addressUtils.js';
import OrderCard from '../../components/orders/OrderCard.jsx';
import styles from './CustomerDashboard.module.css';

export default function CustomerDashboard() {
    const { logout, token } = useAuth();
    const { profile, loadingProfile, ordersState, loadOrders, redirectToLogin } = useOutletContext();
    const { resetState, resetError, resetDisabled, handlePasswordReset } = usePasswordReset({ token });
    const { error: paymentError, loadingId, handleOrderPayment, resetError: resetPaymentError } =
        useOrderPaymentAction();
    const [addressesState, setAddressesState] = useState({
        loading: false,
        error: null,
        items: [],
    });

    useEffect(() => {
        if (ordersState.supported === null && !ordersState.loading) {
            loadOrders({ silent: true }).catch(() => {});
        }
    }, [loadOrders, ordersState.loading, ordersState.supported]);

    useEffect(() => {
        if (!token) return undefined;
        const controller = new AbortController();
        setAddressesState((prev) => ({ ...prev, loading: true, error: null }));
        fetchCustomerAddresses(token, { signal: controller.signal, onUnauthorized: redirectToLogin })
            .then((payload) => {
                if (payload === null) return;
                const list = extractAddressList(payload).map(normalizeAddress);
                setAddressesState({ loading: false, error: null, items: list });
            })
            .catch((error) => {
                if (error?.name === 'AbortError') return;
                if (error?.isUnsupported) {
                    setAddressesState({ loading: false, error: 'Address book is not enabled yet.', items: [] });
                    return;
                }
                setAddressesState({ loading: false, error: error?.message || 'Failed to load addresses', items: [] });
            });
        return () => controller.abort();
    }, [redirectToLogin, token]);

    const sortedOrders = useMemo(
        () =>
            [...(ordersState.items || [])].sort((a, b) => {
                const left = Date.parse(a.createdAt || 0);
                const right = Date.parse(b.createdAt || 0);
                return right - left;
            }),
        [ordersState.items],
    );

    const accountEmail = loadingProfile ? 'Loading…' : profile?.email || '—';
    const accountName = loadingProfile ? 'Loading…' : profile?.fullName || profile?.displayName || '—';
    const accountPhone = loadingProfile ? 'Loading…' : profile?.phoneNumber || '—';

    const defaultAddress = useMemo(() => {
        if (!addressesState.items.length) return null;
        return addressesState.items.find((address) => address.isDefault) || addressesState.items[0];
    }, [addressesState.items]);

    const addressSummary = defaultAddress ? formatAddressLine(defaultAddress) : '—';

    return (
        <div className={styles.grid}>
            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Profile</p>
                        <h2>Account overview</h2>
                        <p className={styles.muted}>Quick snapshot of your account details.</p>
                    </div>
                    <Link to="/account/settings" className={styles.linkButton}>
                        Edit profile
                    </Link>
                </div>

                <div className={styles.summaryGrid}>
                    <div className={styles.summaryItem}>
                        <label>Full name</label>
                        <p>{accountName}</p>
                    </div>
                    <div className={styles.summaryItem}>
                        <label>Email</label>
                        <p>{accountEmail}</p>
                    </div>
                    <div className={styles.summaryItem}>
                        <label>Phone</label>
                        <p>{accountPhone}</p>
                    </div>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Addresses</p>
                        <h2>Default address</h2>
                        <p className={styles.muted}>Manage where orders should be shipped.</p>
                    </div>
                    <Link to="/account/addresses" className={styles.linkButton}>
                        Manage addresses
                    </Link>
                </div>

                {addressesState.loading ? <p className={styles.loading}>Loading addresses…</p> : null}
                {addressesState.error ? (
                    <p className={styles.error} role="alert">
                        {addressesState.error}
                    </p>
                ) : null}
                {!addressesState.loading && !addressesState.error ? (
                    <div className={styles.addressSummary}>
                        <div>
                            <p className={styles.summaryTitle}>
                                {defaultAddress?.label || defaultAddress?.fullName || 'Primary address'}
                            </p>
                            <p className={styles.muted}>{addressSummary}</p>
                        </div>
                        {!defaultAddress ? (
                            <Link to="/account/addresses" className={styles.primaryButton}>
                                Add an address
                            </Link>
                        ) : null}
                    </div>
                ) : null}
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Orders</p>
                        <h2>Recent orders</h2>
                        <p className={styles.muted}>Track your latest purchases.</p>
                    </div>
                    {ordersState.supported ? (
                        <Link to="/account/orders" className={styles.linkButton}>
                            View all
                        </Link>
                    ) : null}
                </div>

                {ordersState.supported === false ? (
                    <div className={styles.banner}>
                        <p>Orders are not enabled for this account.</p>
                    </div>
                ) : (
                    <>
                        {ordersState.loading && <div className={styles.loading}>Loading orders…</div>}
                        {ordersState.error ? (
                            <div className={styles.error} role="alert">
                                {ordersState.error}
                            </div>
                        ) : null}
                        {paymentError ? (
                            <div className={styles.error} role="alert">
                                {paymentError}
                                <button type="button" className={styles.linkButton} onClick={resetPaymentError}>
                                    Dismiss
                                </button>
                            </div>
                        ) : null}
                        {!ordersState.loading && !ordersState.error && sortedOrders.length === 0 ? (
                            <div className={styles.empty}>
                                <p>You have no orders yet. Browse the store to place your first order.</p>
                                <Link to="/store" className={styles.primaryButton}>
                                    Browse the store
                                </Link>
                            </div>
                        ) : null}

                        <div className={styles.orderList}>
                            {sortedOrders.slice(0, 3).map((order) => {
                                const orderLink = `/account/orders/${encodeURIComponent(order.id)}`;
                                return (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        primaryActionTo={orderLink}
                                        detailsTo={orderLink}
                                        onPrimaryAction={handleOrderPayment}
                                        primaryActionLoading={loadingId === order.id}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Quick actions</p>
                        <h2>Keep things moving</h2>
                        <p className={styles.muted}>Common tasks at your fingertips.</p>
                    </div>
                </div>

                <div className={styles.actionGrid}>
                    <Link to="/store" className={styles.primaryButton}>
                        Browse store
                    </Link>
                    <button
                        type="button"
                        className={styles.subtleButton}
                        onClick={handlePasswordReset}
                        disabled={resetDisabled}
                    >
                        {resetState.status === 'sending' ? 'Sending…' : 'Reset password'}
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={() => logout()}>
                        Sign out
                    </button>
                </div>
                {resetState.status === 'sent' ? <p className={styles.successMessage}>{resetState.message}</p> : null}
                {resetError ? <p className={styles.errorMessage}>{resetError}</p> : null}
            </section>
        </div>
    );
}
