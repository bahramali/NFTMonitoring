import React from 'react';
import { Link, useParams } from 'react-router-dom';
import styles from './OrderStatus.module.css';

export default function OrderStatus({ status }) {
    const { orderId } = useParams();
    const isSuccess = status === 'success';

    return (
        <div className={styles.page}>
            <div className={`${styles.card} ${isSuccess ? styles.success : styles.error}`}>
                <p className={styles.kicker}>{isSuccess ? 'Order confirmed' : 'Checkout cancelled'}</p>
                <h1>{isSuccess ? 'Payment confirmed' : 'Payment cancelled'}</h1>
                <p className={styles.subtitle}>
                    Order ID: <strong>{orderId}</strong>
                </p>
                <p className={styles.copy}>
                    {isSuccess
                        ? 'Thank you for shopping with HydroLeaf. A receipt and delivery update will be emailed to you.'
                        : 'You can resume checkout or keep shopping. Your cart remains saved to this session.'}
                </p>
                <div className={styles.actions}>
                    <Link to="/store" className={styles.primary}>Continue shopping</Link>
                    {!isSuccess && (
                        <Link to="/store/checkout" className={styles.secondary}>Return to checkout</Link>
                    )}
                </div>
            </div>
        </div>
    );
}
