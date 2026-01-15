import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { fetchOrderDetail } from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { normalizeOrder } from './orderUtils.js';
import { mapOrderStatus, resolveOrderPrimaryAction } from '../../utils/orderStatus.js';
import { formatCurrency } from '../../utils/currency.js';
import useOrderPaymentAction from '../../hooks/useOrderPaymentAction.js';
import styles from './CustomerOrderDetails.module.css';

const statusVariantStyles = {
    success: styles.statusSuccess,
    warning: styles.statusWarning,
    info: styles.statusInfo,
    danger: styles.statusDanger,
    neutral: styles.statusNeutral,
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

const resolveTotals = (order) => {
    const raw = order?.raw ?? {};
    const totals = raw.totals ?? raw.summary ?? raw.amounts ?? {};
    return {
        currency: order?.currency ?? totals.currency ?? raw.currency ?? 'SEK',
        subtotal:
            raw.subtotal ??
            raw.subTotal ??
            totals.subtotal ??
            totals.subTotal ??
            raw.itemsSubtotal ??
            raw.itemsTotal ??
            null,
        shipping:
            raw.shipping ??
            raw.shippingTotal ??
            totals.shipping ??
            totals.shippingTotal ??
            raw.deliveryFee ??
            null,
        tax: raw.tax ?? raw.taxTotal ?? totals.tax ?? totals.taxTotal ?? null,
        discount:
            raw.discount ??
            raw.discountTotal ??
            totals.discount ??
            totals.discountTotal ??
            raw.promoDiscount ??
            null,
        total: order?.total ?? totals.total ?? raw.total ?? null,
    };
};

const resolvePaymentInfo = (order) => {
    const raw = order?.raw ?? {};
    const payment = raw.payment ?? {};
    return {
        status: order?.paymentStatus ?? payment.status ?? raw.paymentStatus ?? raw.payment_state ?? '',
        method:
            order?.paymentMethod ??
            payment.method ??
            payment.brand ??
            payment.type ??
            raw.paymentMethod ??
            raw.payment_type ??
            '',
        reference:
            payment.reference ??
            payment.id ??
            payment.intentId ??
            payment.transactionId ??
            raw.paymentReference ??
            raw.paymentIntentId ??
            '',
    };
};

const resolveTimeline = (order) => {
    const raw = order?.raw ?? {};
    const timeline = raw.timeline ?? raw.events ?? raw.history ?? raw.statusHistory ?? [];
    if (!Array.isArray(timeline)) return [];
    return timeline
        .map((entry) => ({
            label: entry.label ?? entry.status ?? entry.state ?? entry.title ?? entry.name ?? '',
            timestamp: entry.time ?? entry.timestamp ?? entry.createdAt ?? entry.date ?? entry.updatedAt ?? '',
            detail: entry.description ?? entry.note ?? entry.message ?? entry.details ?? '',
        }))
        .filter((entry) => entry.label || entry.timestamp || entry.detail);
};

export default function CustomerOrderDetails() {
    const { orderId } = useParams();
    const { token } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const { ordersState } = useOutletContext();
    const { error: paymentError, loadingId, handleOrderPayment, resetError: resetPaymentError } =
        useOrderPaymentAction();

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
                <Link to="/account" className={styles.primaryButton}>Back</Link>
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
                <Link to="/account/orders" className={styles.secondaryButton}>Back</Link>
            </div>
        );
    }

    if (!order) return null;

    const primaryAction = resolveOrderPrimaryAction(order.status, { hasTracking: Boolean(order?.trackingUrl) });
    const shouldShowPaymentAction = ['continue-payment', 'retry-payment'].includes(primaryAction.type);
    const totals = resolveTotals(order);
    const paymentInfo = resolvePaymentInfo(order);
    const timeline = resolveTimeline(order);
    const totalsRows = [
        { label: 'Subtotal', value: totals.subtotal },
        { label: 'Shipping', value: totals.shipping },
        { label: 'Tax', value: totals.tax },
        { label: 'Discount', value: totals.discount },
        { label: 'Total', value: totals.total },
    ];
    const shouldShowTotals = totalsRows.some((row) => row.value != null);

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
                    {(() => {
                        const statusMeta = mapOrderStatus(order.status);
                        const badgeClassName =
                            statusVariantStyles[statusMeta.badgeVariant] ?? styles.statusNeutral;
                        return (
                            <span className={`${styles.statusBadge} ${badgeClassName}`}>
                                {statusMeta.label}
                            </span>
                        );
                    })()}
                    {order.paymentStatus ? (
                        <span className={styles.subStatus}>
                            Payment status:
                            {' '}
                            {mapOrderStatus(order.paymentStatus).label}
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

            <div className={styles.detailGrid}>
                <div className={styles.detailCard}>
                    <h3>Totals</h3>
                    {shouldShowTotals ? (
                        <dl className={styles.totalsList}>
                            {totalsRows.map((row) => (
                                <div key={row.label} className={styles.totalsRow}>
                                    <dt>{row.label}</dt>
                                    <dd>
                                        {row.value != null
                                            ? formatCurrency(row.value, totals.currency)
                                            : '—'}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    ) : (
                        <p className={styles.value}>Totals are not available yet.</p>
                    )}
                </div>
                <div className={styles.detailCard}>
                    <h3>Payment</h3>
                    <dl className={styles.totalsList}>
                        <div className={styles.totalsRow}>
                            <dt>Status</dt>
                            <dd>{paymentInfo.status ? mapOrderStatus(paymentInfo.status).label : '—'}</dd>
                        </div>
                        <div className={styles.totalsRow}>
                            <dt>Method</dt>
                            <dd>{paymentInfo.method || '—'}</dd>
                        </div>
                        <div className={styles.totalsRow}>
                            <dt>Reference</dt>
                            <dd>{paymentInfo.reference || '—'}</dd>
                        </div>
                    </dl>
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

            {timeline.length ? (
                <div className={styles.timeline}>
                    <h3>Timeline</h3>
                    <ul className={styles.timelineList}>
                        {timeline.map((entry, index) => (
                            <li key={`${entry.label}-${entry.timestamp}-${index}`} className={styles.timelineItem}>
                                <div>
                                    <p className={styles.timelineLabel}>{entry.label || 'Update'}</p>
                                    {entry.detail ? <p className={styles.timelineDetail}>{entry.detail}</p> : null}
                                </div>
                                <span className={styles.timelineTime}>
                                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div className={styles.actions}>
                {shouldShowPaymentAction ? (
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => handleOrderPayment(order)}
                        disabled={loadingId === order.id}
                    >
                        {loadingId === order.id ? 'Opening payment…' : primaryAction.label}
                    </button>
                ) : null}
                <Link to="/account/orders" className={styles.secondaryButton}>Back to orders</Link>
                <Link to="/account" className={styles.primaryButton}>Back to account</Link>
            </div>
            {paymentError ? (
                <div className={styles.error} role="alert">
                    <p>{paymentError}</p>
                    <button type="button" className={styles.secondaryButton} onClick={resetPaymentError}>
                        Dismiss
                    </button>
                </div>
            ) : null}
        </div>
    );
}
