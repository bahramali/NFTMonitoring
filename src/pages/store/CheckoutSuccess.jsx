import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import styles from './CheckoutReturn.module.css';

export default function CheckoutSuccess() {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <p className={styles.kicker}>Payment received</p>
                <h1 className={styles.title}>Payment received / processing</h1>
                <p className={styles.subtitle}>
                    Thanks for your order! We are confirming your payment with Stripe and will update your order shortly.
                </p>

                <div className={styles.statusCard}>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Checkout session</span>
                        <span className={styles.statusValue}>{sessionId || 'Pending'}</span>
                    </div>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Status</span>
                        <span className={styles.statusValue}>Processing</span>
                    </div>
                </div>

                <div className={styles.actions}>
                    <Link to="/store" className={styles.primary}>Continue shopping</Link>
                    <Link to="/store/cart" className={styles.secondary}>View cart</Link>
                </div>
            </div>
        </div>
    );
}
