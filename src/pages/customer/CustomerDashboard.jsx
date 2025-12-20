import React, { useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../utils/currency.js';
import styles from './CustomerDashboard.module.css';

const statusTone = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (['PAID', 'COMPLETED', 'FULFILLED'].includes(normalized)) return styles.statusPositive;
    if (['CANCELLED', 'FAILED'].includes(normalized)) return styles.statusNegative;
    return styles.statusNeutral;
};

export default function CustomerDashboard() {
    const { logout } = useAuth();
    const { profile, loadingProfile, ordersState, loadOrders } = useOutletContext();

    useEffect(() => {
        if (ordersState.supported === null && !ordersState.loading) {
            loadOrders({ silent: true }).catch(() => {});
        }
    }, [loadOrders, ordersState.loading, ordersState.supported]);

    const sortedOrders = useMemo(
        () =>
            [...(ordersState.items || [])].sort((a, b) => {
                const left = Date.parse(a.createdAt || 0);
                const right = Date.parse(b.createdAt || 0);
                return right - left;
            }),
        [ordersState.items],
    );

    const accountName = loadingProfile ? 'Loading…' : profile?.displayName || '—';
    const accountEmail = loadingProfile ? 'Loading…' : profile?.email || '—';

    return (
        <div className={styles.grid}>
            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Account</p>
                        <h2>Account details</h2>
                        <p className={styles.muted}>Your profile and sign out controls.</p>
                    </div>
                </div>

                <div className={styles.accountGrid}>
                    <div className={styles.field}>
                        <label>Display name</label>
                        <div className={styles.readonly}>{accountName}</div>
                    </div>
                    <div className={styles.field}>
                        <label>Email</label>
                        <div className={styles.readonly}>{accountEmail}</div>
                    </div>
                </div>
                <div className={styles.accountActions}>
                    <button type="button" className={styles.dangerButton} onClick={() => logout()}>
                        Sign out
                    </button>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Orders</p>
                        <h2>Recent orders</h2>
                        <p className={styles.muted}>Track your store purchases.</p>
                    </div>
                    {ordersState.supported ? (
                        <Link to="/my-page/orders" className={styles.linkButton}>
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
                        {!ordersState.loading && !ordersState.error && sortedOrders.length === 0 ? (
                            <div className={styles.empty}>
                                <p>No orders found.</p>
                                <p className={styles.muted}>Your purchases will appear here.</p>
                            </div>
                        ) : null}

                        <div className={styles.orderList}>
                            {sortedOrders.map((order) => (
                                <Link
                                    key={order.id}
                                    to={`/my-page/orders/${encodeURIComponent(order.id)}`}
                                    className={styles.order}
                                >
                                    <div>
                                        <p className={styles.orderId}>Order {order.id}</p>
                                        <p className={styles.orderMeta}>
                                            {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                                        </p>
                                    </div>
                                    <div className={styles.orderStatus}>
                                        <span className={`${styles.statusBadge} ${statusTone(order.status)}`}>
                                            {order.status || 'Unknown'}
                                        </span>
                                        <span className={styles.total}>
                                            {order.total != null ? formatCurrency(order.total, order.currency) : '—'}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
