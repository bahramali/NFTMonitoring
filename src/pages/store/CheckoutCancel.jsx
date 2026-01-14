import React from 'react';
import { Link } from 'react-router-dom';
import styles from './CheckoutReturn.module.css';

export default function CheckoutCancel() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <p className={styles.kicker}>Payment cancelled</p>
                <h1 className={styles.title}>Payment cancelled</h1>
                <p className={styles.subtitle}>
                    Your payment was cancelled. You can return to your cart to try again whenever you are ready.
                </p>

                <div className={styles.actions}>
                    <Link to="/store/cart" className={styles.primary}>Return to cart</Link>
                    <Link to="/store" className={styles.secondary}>Continue shopping</Link>
                </div>
            </div>
        </div>
    );
}
