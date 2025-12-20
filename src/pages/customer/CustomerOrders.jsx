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
                        <p className={styles.kicker}>سفارش‌ها</p>
                        <h1>دسترسی سفارش‌ها فعال نیست</h1>
                        <p className={styles.subtitle}>پشتیبانی سفارش برای این حساب فعال نشده است.</p>
                    </div>
                </div>
                <Link to="/my-page" className={styles.primaryButton}>بازگشت به حساب</Link>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div>
                    <p className={styles.kicker}>سفارش‌ها</p>
                    <h1>سفارش‌های من</h1>
                    <p className={styles.subtitle}>لیست آخرین سفارش‌های ثبت شده در فروشگاه.</p>
                </div>
                <Link to="/my-page" className={styles.secondaryButton}>بازگشت</Link>
            </div>

            {ordersState.loading && <div className={styles.loading}>در حال بارگذاری سفارش‌ها…</div>}
            {localError || ordersState.error ? (
                <div className={styles.error} role="alert">
                    {localError || ordersState.error}
                </div>
            ) : null}

            {!ordersState.loading && sortedOrders.length === 0 && !localError && !ordersState.error ? (
                <div className={styles.empty}>
                    <p>سفارشی ثبت نشده است.</p>
                </div>
            ) : null}

            <div className={styles.list}>
                {sortedOrders.map((order) => (
                    <Link key={order.id} to={`/my-page/orders/${encodeURIComponent(order.id)}`} className={styles.order}>
                        <div>
                            <p className={styles.orderId}>شناسه سفارش: {order.id}</p>
                            <p className={styles.orderMeta}>
                                ثبت شده در
                                {' '}
                                {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                            </p>
                        </div>
                        <div className={styles.orderStatus}>
                            <span className={`${styles.statusBadge} ${statusTone(order.status)}`}>
                                {order.status || 'نامشخص'}
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
