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
                <p className={styles.kicker}>Order</p>
                <h1>Order details unavailable</h1>
                <p className={styles.subtitle}>Order details are not available for this account.</p>
                <Link to="/my-page" className={styles.primaryButton}>Back</Link>
            </div>
        );
    }

    if (loading) {
        return <div className={styles.loading}>Loading order…</div>;
    }

    if (error) {
        return (
            <div className={styles.card}>
                <p className={styles.error} role="alert">{error}</p>
                <Link to="/my-page/orders" className={styles.secondaryButton}>Back</Link>
            </div>
        );
    }

    if (!order) return null;

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div>
                    <p className={styles.kicker}>Order</p>
                    <h1>Order {order.id}</h1>
                    <p className={styles.subtitle}>
                        Placed on
                        {' '}
                        {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                    </p>
                </div>
                <div className={styles.statusBlock}>
                    <span className={`${styles.statusBadge} ${statusTone(order.status)}`}>
                        {order.status || 'Unknown'}
                    </span>
                    {order.paymentStatus ? (
                        <span className={styles.subStatus}>
                            Payment status:
                            {' '}
                            {order.paymentStatus}
                        </span>
                    ) : null}
                </div>
            </div>

            <div className={styles.metaGrid}>
                <div>
                    <p className={styles.label}>Total</p>
                    <p className={styles.value}>
                        {order.total != null ? formatCurrency(order.total, order.currency) : '—'}
                    </p>
                </div>
                <div>
                    <p className={styles.label}>Updated</p>
                    <p className={styles.value}>
                        {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '—'}
                    </p>
                </div>
                <div>
                    <p className={styles.label}>Address</p>
                    <p className={styles.value}>{formatAddress(order.shippingAddress)}</p>
                </div>
            </div>

            <div className={styles.items}>
                <h3>Items</h3>
                {!order.items?.length ? (
                    <p className={styles.value}>No items recorded.</p>
                ) : (
                    <div className={styles.itemGrid}>
                        {order.items.map((item, index) => (
                            <div key={item.id ?? item.sku ?? index} className={styles.item}>
                                <p className={styles.itemName}>{item.name ?? item.title ?? 'Item'}</p>
                                <p className={styles.itemMeta}>
                                    Quantity:
                                    {' '}
                                    {item.quantity ?? item.qty ?? 1}
                                </p>
                                <p className={styles.itemMeta}>
                                    Unit price:
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
                    <p className={styles.label}>Note</p>
                    <p className={styles.value}>{order.customerNote}</p>
                </div>
            ) : null}

            <div className={styles.actions}>
                <Link to="/my-page/orders" className={styles.secondaryButton}>Back to orders</Link>
                <Link to="/my-page" className={styles.primaryButton}>Back to account</Link>
            </div>
        </div>
    );
}
