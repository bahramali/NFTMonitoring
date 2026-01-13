import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './PaymentReturn.module.css';

export default function PaymentCancel() {
    const [searchParams] = useSearchParams();
    const sessionId = useMemo(
        () => searchParams.get('session_id') || searchParams.get('sessionId'),
        [searchParams],
    );
    const orderId = useMemo(() => searchParams.get('orderId'), [searchParams]);

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
                        <span className={styles.statusValue}>{sessionId || 'Not provided'}</span>
                    </div>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Order ID</span>
                        <span className={styles.statusValue}>{orderId || 'Not provided'}</span>
                    </div>
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
