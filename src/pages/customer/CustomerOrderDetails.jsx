import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { fetchOrderDetail } from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { normalizeOrder } from './orderUtils.js';
import { formatCurrency } from '../../utils/currency.js';
import styles from './CustomerOrderDetails.module.css';

const statusTone = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (['PAID', 'COMPLETED', 'FULFILLED'].includes(normalized)) return styles.statusPositive;
    if (['CANCELLED', 'FAILED'].includes(normalized)) return styles.statusNegative;
    return styles.statusNeutral;
};

const formatAddress = (value) => {
    if (!value) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        const parts = [
            value.line1 ?? value.address1,
            value.line2 ?? value.address2,
            value.city,
            value.state ?? value.province,
            value.postalCode ?? value.zip,
            value.country,
        ]
            .filter(Boolean)
            .map((part) => String(part).trim())
            .filter(Boolean);
        if (parts.length) return parts.join(', ');
        try {
            return JSON.stringify(value);
        } catch {
            return '—';
        }
    }
    return String(value);
};

export default function CustomerOrderDetails() {
    const { orderId } = useParams();
    const { token } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const { ordersState } = useOutletContext();

    const existingOrder = useMemo(
        () => (ordersState?.items || []).find((order) => String(order.id) === String(orderId)),
        [orderId, ordersState?.items],
    );

    const [order, setOrder] = useState(existingOrder || null);
    const [loading, setLoading] = useState(!existingOrder);
    const [error, setError] = useState(null);
    const [unsupported, setUnsupported] = useState(ordersState?.supported === false);

    useEffect(() => {
        if (!token || !orderId) return undefined;
        if (ordersState.supported === false) {
            setUnsupported(true);
            return undefined;
        }

        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const payload = await fetchOrderDetail(token, orderId, {
                    signal: controller.signal,
                    onUnauthorized: redirectToLogin,
                });
                if (payload === null) return;
                setOrder(normalizeOrder(payload));
            } catch (err) {
                if (err?.name === 'AbortError') return;
                if (err?.isUnsupported) {
                    setUnsupported(true);
                    return;
                }
                setError(err?.message || 'Failed to load order');
            } finally {
                setLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [orderId, ordersState.supported, redirectToLogin, token]);

    if (unsupported) {
        return (
            <div className={styles.card}>
                <p className={styles.kicker}>سفارش</p>
                <h1>نمایش سفارش فعال نیست</h1>
                <p className={styles.subtitle}>نمایش جزئیات سفارش برای این حساب در دسترس نیست.</p>
                <Link to="/my-page" className={styles.primaryButton}>بازگشت</Link>
            </div>
        );
    }

    if (loading) {
        return <div className={styles.loading}>در حال بارگذاری سفارش…</div>;
    }

    if (error) {
        return (
            <div className={styles.card}>
                <p className={styles.error} role="alert">{error}</p>
                <Link to="/my-page/orders" className={styles.secondaryButton}>بازگشت</Link>
            </div>
        );
    }

    if (!order) return null;

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div>
                    <p className={styles.kicker}>سفارش</p>
                    <h1>سفارش {order.id}</h1>
                    <p className={styles.subtitle}>
                        ثبت شده در
                        {' '}
                        {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                    </p>
                </div>
                <div className={styles.statusBlock}>
                    <span className={`${styles.statusBadge} ${statusTone(order.status)}`}>
                        {order.status || 'نامشخص'}
                    </span>
                    {order.paymentStatus ? (
                        <span className={styles.subStatus}>
                            وضعیت پرداخت:
                            {' '}
                            {order.paymentStatus}
                        </span>
                    ) : null}
                </div>
            </div>

            <div className={styles.metaGrid}>
                <div>
                    <p className={styles.label}>مبلغ</p>
                    <p className={styles.value}>
                        {order.total != null ? formatCurrency(order.total, order.currency) : '—'}
                    </p>
                </div>
                <div>
                    <p className={styles.label}>به‌روزرسانی</p>
                    <p className={styles.value}>
                        {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '—'}
                    </p>
                </div>
                <div>
                    <p className={styles.label}>آدرس</p>
                    <p className={styles.value}>{formatAddress(order.shippingAddress)}</p>
                </div>
            </div>

            <div className={styles.items}>
                <h3>اقلام</h3>
                {!order.items?.length ? (
                    <p className={styles.value}>هیچ موردی ثبت نشده است.</p>
                ) : (
                    <div className={styles.itemGrid}>
                        {order.items.map((item, index) => (
                            <div key={item.id ?? item.sku ?? index} className={styles.item}>
                                <p className={styles.itemName}>{item.name ?? item.title ?? 'کالا'}</p>
                                <p className={styles.itemMeta}>
                                    تعداد:
                                    {' '}
                                    {item.quantity ?? item.qty ?? 1}
                                </p>
                                <p className={styles.itemMeta}>
                                    قیمت واحد:
                                    {' '}
                                    {item.price != null || item.unitPrice != null || item.amount != null
                                        ? formatCurrency(
                                            item.price ?? item.unitPrice ?? item.amount,
                                            order.currency,
                                        )
                                        : '—'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {order.customerNote ? (
                <div className={styles.note}>
                    <p className={styles.label}>یادداشت</p>
                    <p className={styles.value}>{order.customerNote}</p>
                </div>
            ) : null}

            <div className={styles.actions}>
                <Link to="/my-page/orders" className={styles.secondaryButton}>بازگشت به سفارش‌ها</Link>
                <Link to="/my-page" className={styles.primaryButton}>بازگشت به حساب</Link>
            </div>
        </div>
    );
}
