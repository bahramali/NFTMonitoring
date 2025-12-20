import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import styles from './CustomerOrders.module.css';
import { formatCurrency } from '../../utils/currency.js';

const statusTone = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (['PAID', 'COMPLETED', 'FULFILLED'].includes(normalized)) return styles.statusPositive;
    if (['CANCELLED', 'FAILED'].includes(normalized)) return styles.statusNegative;
    return styles.statusNeutral;
};

export default function CustomerOrders() {
    const { ordersState, loadOrders } = useOutletContext();
    const [localError, setLocalError] = useState(null);

    useEffect(() => {
        if (ordersState.supported === false) return undefined;
        const controller = new AbortController();
        loadOrders({ signal: controller.signal }).catch((error) => {
            if (error?.name === 'AbortError') return;
            setLocalError(error?.message || 'Failed to load orders');
        });
        return () => controller.abort();
    }, [loadOrders, ordersState.supported]);

    const sortedOrders = useMemo(
        () =>
            [...(ordersState.items || [])].sort((a, b) => {
                const left = Date.parse(a.createdAt || 0);
                const right = Date.parse(b.createdAt || 0);
                return right - left;
            }),
        [ordersState.items],
    );

    if (ordersState.supported === false) {
        return (
            <div className={styles.card}>
                <div className={styles.header}>
                    <div>
                        <p className={styles.kicker}>Orders</p>
                        <h1>Orders unavailable</h1>
                        <p className={styles.subtitle}>Order history is not enabled for this account.</p>
                    </div>
                </div>
                <Link to="/my-page" className={styles.primaryButton}>Back to account</Link>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div>
                    <p className={styles.kicker}>Orders</p>
                    <h1>My orders</h1>
                    <p className={styles.subtitle}>Recent orders placed in the store.</p>
                </div>
                <Link to="/my-page" className={styles.secondaryButton}>Back</Link>
            </div>

            {ordersState.loading && <div className={styles.loading}>Loading orders…</div>}
            {localError || ordersState.error ? (
                <div className={styles.error} role="alert">
                    {localError || ordersState.error}
                </div>
            ) : null}

            {!ordersState.loading && sortedOrders.length === 0 && !localError && !ordersState.error ? (
                <div className={styles.empty}>
                    <p>No orders found.</p>
                </div>
            ) : null}

            <div className={styles.list}>
                {sortedOrders.map((order) => (
                    <Link key={order.id} to={`/my-page/orders/${encodeURIComponent(order.id)}`} className={styles.order}>
                        <div>
                            <p className={styles.orderId}>Order ID: {order.id}</p>
                            <p className={styles.orderMeta}>
                                Placed on
                                {' '}
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
        </div>
    );
}
