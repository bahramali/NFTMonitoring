import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchOrderStatus } from '../../api/store.js';
import styles from './PaymentReturn.module.css';

const resolveOrderStatus = (order) => (
    order?.paymentStatus
    ?? order?.status
    ?? order?.state
    ?? order?.payment_state
    ?? 'Unknown'
);

export default function PaymentSuccess() {
    const [searchParams] = useSearchParams();
    const orderId = useMemo(() => searchParams.get('orderId'), [searchParams]);
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!orderId) return;
        let isMounted = true;
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetchOrderStatus(orderId, { signal: controller.signal })
            .then((payload) => {
                if (!isMounted) return;
                setOrder(payload);
            })
            .catch((err) => {
                if (!isMounted) return;
                if (err?.name === 'AbortError') return;
                setError(err?.message || 'Unable to load order status.');
            })
            .finally(() => {
                if (!isMounted) return;
                setLoading(false);
            });

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [orderId]);

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <p className={styles.kicker}>Payment completed</p>
                <h1 className={styles.title}>Thank you</h1>
                <p className={styles.subtitle}>
                    We are confirming your order with our payment provider.
                </p>

                <div className={styles.statusCard}>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Order ID</span>
                        <span className={styles.statusValue}>{orderId || 'Missing'}</span>
                    </div>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Order status</span>
                        <span className={styles.statusValue}>
                            {loading ? 'Loading…' : resolveOrderStatus(order)}
                        </span>
                    </div>
                    {loading ? <p className={styles.loading}>Fetching latest status…</p> : null}
                    {error ? <p className={styles.error}>{error}</p> : null}
                </div>

                <div className={styles.actions}>
                    <Link to="/store" className={styles.primary}>Continue shopping</Link>
                    <Link to="/store/checkout" className={styles.secondary}>View checkout</Link>
                </div>
                <p className={styles.notice}>
                    Payment completion is verified by the backend. Please wait for the final order status update.
                </p>
            </div>
        </div>
    );
}
