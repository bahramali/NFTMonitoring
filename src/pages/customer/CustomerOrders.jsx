import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import OrderCard from '../../components/orders/OrderCard.jsx';
import useOrderPaymentAction from '../../hooks/useOrderPaymentAction.js';
import styles from './CustomerOrders.module.css';

export default function CustomerOrders() {
    const { ordersState, loadOrders } = useOutletContext();
    const [localError, setLocalError] = useState(null);
    const { error: paymentError, loadingId, handleOrderPayment, resetError } = useOrderPaymentAction();

    const handleLoadOrders = useCallback(
        (options = {}) =>
            loadOrders(options).catch((error) => {
                if (error?.name === 'AbortError') return;
                setLocalError(error?.message || 'Failed to load orders');
            }),
        [loadOrders],
    );

    useEffect(() => {
        if (ordersState.supported === false || ordersState.rateLimited || ordersState.hasFetched) return undefined;
        const controller = new AbortController();
        setLocalError(null);
        handleLoadOrders({ signal: controller.signal });
        return () => controller.abort();
    }, []);

    const handleRetry = () => {
        setLocalError(null);
        handleLoadOrders();
    };

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
                <Link to="/account" className={styles.primaryButton}>Back to account</Link>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div>
                    <p className={styles.kicker}>Orders</p>
                    <h1>My orders</h1>
                    <p className={styles.subtitle}>Recent orders placed in the store</p>
                </div>
            </div>

            {ordersState.loading ? (
                <div className={styles.loading} aria-live="polite" aria-label="Loading orders">
                    {[...Array(3)].map((_, index) => (
                        <div key={`skeleton-${index}`} className={styles.skeletonCard}>
                            <div className={styles.skeletonRow} />
                            <div className={styles.skeletonRowShort} />
                        </div>
                    ))}
                </div>
            ) : null}

            {!ordersState.loading && (localError || ordersState.error) ? (
                <div className={styles.error} role="alert">
                    <p className={styles.errorMessage}>{localError || ordersState.error}</p>
                    {!ordersState.rateLimited ? (
                        <button type="button" className={styles.retryButton} onClick={handleRetry}>
                            Retry
                        </button>
                    ) : null}
                </div>
            ) : null}
            {!ordersState.loading && paymentError ? (
                <div className={styles.error} role="alert">
                    <p className={styles.errorMessage}>{paymentError}</p>
                    <button type="button" className={styles.retryButton} onClick={resetError}>
                        Dismiss
                    </button>
                </div>
            ) : null}

            {!ordersState.loading && sortedOrders.length === 0 && !localError && !ordersState.error ? (
                <div className={styles.empty}>
                    <p>You haven’t placed any orders yet</p>
                    <Link className={styles.primaryButton} to="/store">Go to Store</Link>
                </div>
            ) : null}

            <div className={styles.list}>
                {sortedOrders.map((order) => {
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
        </div>
    );
}
