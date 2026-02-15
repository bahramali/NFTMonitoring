import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import AccountCard from '../../components/account/AccountCard.jsx';
import OrderRow from '../../components/orders/OrderRow.jsx';
import { fetchCustomerAddresses } from '../../api/customerAddresses.js';
import { useAuth } from '../../context/AuthContext.jsx';
import usePasswordReset from '../../hooks/usePasswordReset.js';
import { extractAddressList, formatAddressLine, normalizeAddress } from './addressUtils.js';
import { formatCurrency } from '../../utils/currency.js';
import styles from './CustomerDashboard.module.css';

export default function CustomerDashboard() {
    const { token } = useAuth();
    const { profile, loadingProfile, ordersState, loadOrders, redirectToLogin } = useOutletContext();
    const { resetState, resetError, resetDisabled, handlePasswordReset } = usePasswordReset({ token });
    const [addressesState, setAddressesState] = useState({ loading: false, error: null, items: [] });

    useEffect(() => {
        if (ordersState.supported === null && !ordersState.loading && !ordersState.hasFetched) {
            loadOrders({ silent: true }).catch(() => {});
        }
    }, [loadOrders, ordersState.hasFetched, ordersState.loading, ordersState.supported]);

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
                setAddressesState({ loading: false, error: error?.message || 'Failed to load addresses', items: [] });
            });
        return () => controller.abort();
    }, [redirectToLogin, token]);

    const sortedOrders = useMemo(
        () => [...(ordersState.items || [])].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)),
        [ordersState.items],
    );

    const latestOrder = sortedOrders[0] || null;
    const accountName = loadingProfile ? 'Loading…' : profile?.fullName || profile?.displayName || '—';
    const accountEmail = loadingProfile ? 'Loading…' : profile?.email || '—';
    const accountPhone = loadingProfile ? 'Loading…' : profile?.phoneNumber || '—';
    const defaultAddress = addressesState.items.find((address) => address.isDefault) || addressesState.items[0] || null;

    return (
        <div className={styles.dashboardGrid}>
            <div className={styles.topRow}>
                <AccountCard
                    title="Profile"
                    subtitle="Your core account information"
                    action={<Link to="/account/settings" className={styles.primaryButton}>Edit profile</Link>}
                >
                    <div className={styles.facts}>
                        <p><strong>Name:</strong> {accountName}</p>
                        <p><strong>Email:</strong> {accountEmail}</p>
                        <p><strong>Phone:</strong> {accountPhone}</p>
                    </div>
                </AccountCard>

                <AccountCard
                    title="Default address"
                    subtitle="Where your orders are delivered"
                    action={<Link to="/account/addresses" className={styles.primaryButton}>Manage</Link>}
                >
                    {addressesState.loading ? <p className={styles.muted}>Loading address…</p> : null}
                    {addressesState.error ? <p className={styles.error}>{addressesState.error}</p> : null}
                    {!addressesState.loading && !addressesState.error ? (
                        <p className={styles.facts}>{defaultAddress ? formatAddressLine(defaultAddress) : 'No default address yet.'}</p>
                    ) : null}
                </AccountCard>
            </div>

            <div className={styles.mainRow}>
                <div className={styles.mainColumn}>
                    <AccountCard title="Orders" subtitle="Track status and open documents quickly">
                        {ordersState.loading ? <p className={styles.muted}>Loading orders…</p> : null}
                        {ordersState.error ? <p className={styles.error}>{ordersState.error}</p> : null}
                        {!ordersState.loading && !ordersState.error && sortedOrders.length === 0 ? (
                            <p className={styles.muted}>No orders yet. <Link to="/store">Browse store</Link></p>
                        ) : null}
                        <div className={styles.orderRows}>
                            {sortedOrders.slice(0, 5).map((order) => (
                                <OrderRow
                                    key={order.id}
                                    order={order}
                                    detailsTo={`/account/orders/${encodeURIComponent(order.id)}`}
                                    receiptAvailable={['PAID', 'COMPLETED'].includes(String(order?.status || '').toUpperCase())}
                                    compact
                                />
                            ))}
                        </div>
                        <Link to="/account/orders" className={styles.secondaryLink}>View all orders</Link>
                    </AccountCard>
                </div>

                <div className={styles.sideColumn}>
                    <AccountCard title="Recent order" subtitle="Quick actions">
                        {latestOrder ? (
                            <div className={styles.recentOrder}>
                                <p><strong>Order #{latestOrder.id}</strong></p>
                                <p>{new Date(latestOrder.createdAt || Date.now()).toLocaleDateString()}</p>
                                <p>Total: <strong>{formatCurrency(latestOrder.total, latestOrder.currency)}</strong></p>
                                <Link to={`/account/orders/${encodeURIComponent(latestOrder.id)}`} className={styles.primaryButton}>View</Link>
                            </div>
                        ) : (
                            <p className={styles.muted}>No recent orders yet.</p>
                        )}
                    </AccountCard>

                    <AccountCard
                        title="Security"
                        subtitle="Keep your account protected"
                        action={
                            <button type="button" className={styles.primaryButton} onClick={handlePasswordReset} disabled={resetDisabled}>
                                {resetState.status === 'sending' ? 'Sending…' : 'Change password'}
                            </button>
                        }
                    >
                        <p className={styles.muted}>Password last updated: Not available</p>
                        {resetState.status === 'sent' ? <p className={styles.success}>{resetState.message}</p> : null}
                        {resetError ? <p className={styles.error}>{resetError}</p> : null}
                    </AccountCard>
                </div>
            </div>
        </div>
    );
}
