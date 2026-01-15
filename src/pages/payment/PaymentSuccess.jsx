import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchOrderStatus } from '../../api/store.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { formatCurrency } from '../../utils/currency.js';
import { mapOrderStatus } from '../../utils/orderStatus.js';
import styles from './PaymentReturn.module.css';

const resolveOrderStatus = (order) => (
    order?.paymentStatus
    ?? order?.status
    ?? order?.state
    ?? order?.payment_state
    ?? 'Unknown'
);

const resolveOrderItems = (order) => (
    order?.items
    ?? order?.lineItems
    ?? order?.orderItems
    ?? []
);

const resolveTotals = (order) => ({
    currency: order?.currency ?? order?.totals?.currency ?? 'SEK',
    subtotal: order?.subtotal ?? order?.totals?.subtotal ?? null,
    total: order?.total ?? order?.totals?.total ?? null,
});

const isPaidStatus = (status) => {
    if (!status) return false;
    const normalized = `${status}`.toLowerCase();
    return ['paid', 'confirmed', 'succeeded', 'complete', 'completed'].includes(normalized);
};

const isPendingStatus = (status) => {
    if (!status) return true;
    const normalized = `${status}`.toLowerCase();
    return ['pending', 'processing', 'requires_payment_method', 'requires_action', 'unpaid', 'open'].includes(normalized);
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_COUNT = 5;

export default function PaymentSuccess() {
    const { orderId } = useParams();
    const { clearCart } = useStorefront();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pollCount, setPollCount] = useState(0);
    const [referenceId, setReferenceId] = useState(null);

    useEffect(() => {
        if (!referenceId) return;
        console.info('Order status request correlation id received.', { correlationId: referenceId });
    }, [referenceId]);

    useEffect(() => {
        if (!orderId) return;
        let isMounted = true;
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        const loadOrder = () => fetchOrderStatus(orderId, { signal: controller.signal });

        loadOrder()
            .then(({ data, correlationId }) => {
                if (!isMounted) return;
                setOrder(data);
                if (correlationId) {
                    setReferenceId((prev) => (prev === correlationId ? prev : correlationId));
                }
            })
            .catch((err) => {
                if (!isMounted) return;
                if (err?.name === 'AbortError') return;
                setError(err?.message || 'Unable to load order status.');
                if (err?.correlationId) {
                    setReferenceId((prev) => (prev === err.correlationId ? prev : err.correlationId));
                }
            })
            .finally(() => {
                if (!isMounted) return;
                setLoading(false);
            });

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [orderId, pollCount]);

    useEffect(() => {
        const status = resolveOrderStatus(order);
        if (!isPendingStatus(status)) return;
        if (pollCount >= MAX_POLL_COUNT) return;
        const timer = setTimeout(() => setPollCount((count) => count + 1), POLL_INTERVAL_MS);
        return () => clearTimeout(timer);
    }, [order, pollCount]);

    const status = resolveOrderStatus(order);
    const isPaid = isPaidStatus(status);
    const isPending = isPendingStatus(status);
    const statusLabel = mapOrderStatus(status).label;
    const items = resolveOrderItems(order);
    const totals = resolveTotals(order);
    const currency = totals.currency || 'SEK';
    const title = isPaid ? 'Order confirmed' : isPending ? 'در حال تایید پرداخت' : 'Payment status updated';
    const subtitle = isPaid
        ? 'Payment received. Your order is confirmed.'
        : isPending
            ? 'در حال تایید پرداخت. We are confirming your payment with our provider.'
            : 'Your payment status was updated. Please contact support if you need help.';

    useEffect(() => {
        if (!isPaid) return;
        clearCart();
    }, [clearCart, isPaid]);

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <p className={styles.kicker}>Payment completed</p>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.subtitle}>{subtitle}</p>

                <div className={styles.statusCard}>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Checkout session</span>
                        <span className={styles.statusValue}>Handled by Stripe</span>
                    </div>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Order ID</span>
                        <span className={styles.statusValue}>{order?.id || orderId || 'Pending'}</span>
                    </div>
                    {referenceId ? (
                        <div className={styles.statusRow}>
                            <span className={styles.statusLabel}>Reference ID</span>
                            <span className={styles.statusValue}>{referenceId}</span>
                        </div>
                    ) : null}
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Order status</span>
                        <span className={styles.statusValue}>
                            {loading ? 'Loading…' : statusLabel}
                        </span>
                    </div>
                    {loading ? <p className={styles.loading}>Fetching latest status…</p> : null}
                    {isPending && !loading ? (
                        <p className={styles.loading}>Awaiting confirmation…</p>
                    ) : null}
                    {error ? <p className={styles.error}>{error}</p> : null}
                </div>

                {isPaid && items.length ? (
                    <div className={styles.orderSummary}>
                        <h2>Order summary</h2>
                        <div className={styles.items}>
                            {items.map((item, index) => (
                                <div key={item.id || `${item.productId}-${item.variantId}-${index}`} className={styles.itemRow}>
                                    <div>
                                        <p className={styles.itemName}>{item.name || item.title || 'Item'}</p>
                                        <p className={styles.itemMeta}>
                                            {(item.quantity ?? item.qty ?? 1)} × {formatCurrency(item.unitPrice ?? item.price ?? 0, currency)}
                                        </p>
                                    </div>
                                    <span className={styles.itemTotal}>
                                        {formatCurrency(item.total ?? item.lineTotal ?? 0, currency)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className={styles.summaryRow}>
                            <span>Subtotal</span>
                            <span>{formatCurrency(totals.subtotal ?? 0, currency)}</span>
                        </div>
                        <div className={styles.summaryRowTotal}>
                            <span>Total</span>
                            <span>{formatCurrency(totals.total ?? totals.subtotal ?? 0, currency)}</span>
                        </div>
                    </div>
                ) : null}

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
