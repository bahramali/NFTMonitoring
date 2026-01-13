import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchOrderStatus } from '../../api/store.js';
import styles from './PaymentReturn.module.css';

export default function PaymentCancel() {
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!orderId) return;
        const controller = new AbortController();
        fetchOrderStatus(orderId, { signal: controller.signal })
            .then((payload) => setOrder(payload))
            .catch((err) => {
                if (err?.name === 'AbortError') return;
                setError(err?.message || 'Unable to load order status.');
            });

        return () => controller.abort();
    }, [orderId]);

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <p className={styles.kicker}>Payment canceled</p>
                <h1 className={styles.title}>Payment canceled</h1>
                <p className={styles.subtitle}>
                    Your payment was not completed. You can retry when you are ready.
                </p>

                <div className={styles.statusCard}>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Checkout session</span>
                        <span className={styles.statusValue}>Handled by Stripe</span>
                    </div>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Order ID</span>
                        <span className={styles.statusValue}>{order?.id || orderId || 'Not provided'}</span>
                    </div>
                    {order?.status ? (
                        <div className={styles.statusRow}>
                            <span className={styles.statusLabel}>Order status</span>
                            <span className={styles.statusValue}>{order.status}</span>
                        </div>
                    ) : null}
                    {error ? <p className={styles.error}>{error}</p> : null}
                </div>

                <div className={styles.actions}>
                    <Link to="/store/checkout" className={styles.primary}>Retry payment</Link>
                    <Link to="/store" className={styles.secondary}>Continue shopping</Link>
                </div>
                <p className={styles.notice}>
                    Order payment status is determined by the backend. This page does not mark orders as paid.
                </p>
            </div>
        </div>
    );
}
