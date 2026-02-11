import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { emailOrderInvoice, fetchOrderDetail } from '../../api/customer.js';
import { getApiBaseUrl } from '../../config/apiBase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import useOrderPaymentAction from '../../hooks/useOrderPaymentAction.js';
import { mapOrderStatus, resolveOrderPrimaryAction } from '../../utils/orderStatus.js';
import { formatCurrency } from '../../utils/currency.js';
import { normalizeOrder } from './orderUtils.js';
import styles from './CustomerOrderDetails.module.css';

const API_BASE = getApiBaseUrl();
const TERMINAL_STATUSES = new Set(['PAID', 'FAILED', 'REFUNDED', 'COMPLETED', 'CANCELLED', 'CANCELED']);
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 180000;

const statusVariantStyles = {
    success: styles.statusSuccess,
    warning: styles.statusWarning,
    info: styles.statusInfo,
    danger: styles.statusDanger,
    neutral: styles.statusNeutral,
};

const toStatusKey = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const isPendingStatus = (value) => !TERMINAL_STATUSES.has(toStatusKey(value));

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
    }
    return '—';
};

const resolveTotals = (order) => {
    const raw = order?.raw ?? {};
    const totals = raw.totals ?? raw.summary ?? raw.amounts ?? {};
    const fallbackSubtotal = Array.isArray(order?.items)
        ? order.items.reduce((sum, item) => {
            const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1;
            const unitPrice = Number(item?.price ?? item?.unitPrice ?? item?.amount ?? 0) || 0;
            const lineTotal = item?.lineTotal ?? item?.total;
            return sum + (lineTotal != null ? Number(lineTotal) || 0 : quantity * unitPrice);
        }, 0)
        : null;

    const subtotal =
        raw.subtotal ?? raw.subTotal ?? totals.subtotal ?? totals.subTotal ?? raw.itemsSubtotal ?? raw.itemsTotal ?? fallbackSubtotal;
    const shipping = raw.shipping ?? raw.shippingTotal ?? totals.shipping ?? totals.shippingTotal ?? raw.deliveryFee ?? 0;
    const tax = raw.tax ?? raw.taxTotal ?? totals.tax ?? totals.taxTotal ?? 0;
    const discount = raw.discount ?? raw.discountTotal ?? totals.discount ?? totals.discountTotal ?? raw.promoDiscount ?? 0;
    const total = order?.total ?? totals.total ?? raw.total ?? (subtotal != null ? subtotal + shipping + tax - discount : null);

    return {
        currency: order?.currency ?? totals.currency ?? raw.currency ?? 'SEK',
        subtotal,
        shipping,
        tax,
        discount,
        total,
    };
};

const resolvePaymentInfo = (order) => {
    const raw = order?.raw ?? {};
    const payment = raw.payment ?? {};
    const method =
        order?.paymentMethod ?? payment.method ?? payment.brand ?? payment.type ?? raw.paymentMethod ?? raw.payment_type ?? '';
    const last4 = payment.last4 ?? raw.paymentMethodLast4 ?? raw.last4 ?? '';
    return {
        status: order?.paymentStatus ?? payment.status ?? raw.paymentStatus ?? raw.payment_state ?? order?.status ?? '',
        method: last4 ? `${method} •••• ${last4}`.trim() : method,
        reference:
            payment.reference ?? payment.id ?? payment.intentId ?? payment.transactionId ?? raw.paymentReference ?? raw.paymentIntentId ?? '',
    };
};

const resolveTimeline = (order, paymentStatus) => {
    const statusKey = toStatusKey(paymentStatus || order?.status);
    const deliveryType = toStatusKey(order?.deliveryType ?? order?.raw?.deliveryType ?? 'PICKUP');
    const labels = [
        'Order placed',
        'Payment confirmed',
        'Preparing',
        deliveryType === 'SHIPPING' ? 'Shipped' : 'Ready for pickup',
        'Completed',
    ];

    let currentIndex = 0;
    if (['PAID', 'PAYMENT_SUCCEEDED'].includes(statusKey)) currentIndex = 1;
    if (['PROCESSING'].includes(statusKey)) currentIndex = 2;
    if (['SHIPPED', 'READY_FOR_PICKUP'].includes(statusKey)) currentIndex = 3;
    if (['DELIVERED', 'COMPLETED'].includes(statusKey)) currentIndex = 4;

    return labels.map((label, index) => ({ label, state: index <= currentIndex ? 'done' : 'pending' }));
};

const isDocumentAvailable = (order, key) => {
    const raw = order?.raw ?? {};
    return Boolean(
        raw?.documents?.[key]?.available
        ?? raw?.[`${key}Available`]
        ?? raw?.payment?.[`${key}Available`]
        ?? (key === 'receipt' && ['PAID', 'PAYMENT_SUCCEEDED'].includes(toStatusKey(order?.paymentStatus ?? order?.status))),
    );
};

export default function CustomerOrderDetails() {
    const { orderId } = useParams();
    const { token } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const { ordersState } = useOutletContext();
    const { error: paymentError, loadingId, handleOrderPayment, resetError: resetPaymentError } = useOrderPaymentAction();

    const existingOrder = useMemo(
        () => (ordersState?.items || []).find((order) => String(order.id) === String(orderId)),
        [orderId, ordersState?.items],
    );

    const [order, setOrder] = useState(existingOrder || null);
    const [loading, setLoading] = useState(!existingOrder);
    const [error, setError] = useState(null);
    const [unsupported, setUnsupported] = useState(ordersState?.supported === false);
    const [refreshTick, setRefreshTick] = useState(0);
    const [pollStartedAt, setPollStartedAt] = useState(Date.now());
    const [copyState, setCopyState] = useState('idle');
    const [invoiceEmailState, setInvoiceEmailState] = useState('idle');

    useEffect(() => {
        if (!token || !orderId) return undefined;
        if (ordersState.supported === false) {
            setUnsupported(true);
            return undefined;
        }

        const controller = new AbortController();
        const load = async () => {
            setLoading((prev) => (order ? prev : true));
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
                if (err?.status === 404 && Date.now() - pollStartedAt < POLL_TIMEOUT_MS) {
                    return;
                }
                setError(err?.message || 'Failed to load order');
            } finally {
                setLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [orderId, ordersState.supported, pollStartedAt, redirectToLogin, refreshTick, token]);

    const paymentInfo = resolvePaymentInfo(order);
    const effectiveStatus = paymentInfo.status || order?.status;

    useEffect(() => {
        if (!orderId || !isPendingStatus(effectiveStatus)) return undefined;
        if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) return undefined;
        const timer = setTimeout(() => setRefreshTick((prev) => prev + 1), POLL_INTERVAL_MS);
        return () => clearTimeout(timer);
    }, [effectiveStatus, orderId, pollStartedAt]);

    const handleCopyReference = async () => {
        if (!paymentInfo.reference || !navigator?.clipboard?.writeText) return;
        await navigator.clipboard.writeText(paymentInfo.reference);
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 1200);
    };

    const handleRefreshStatus = () => {
        setPollStartedAt(Date.now());
        setRefreshTick((prev) => prev + 1);
    };

    const handleEmailInvoice = async () => {
        if (!token || !orderId) return;
        setInvoiceEmailState('sending');
        try {
            await emailOrderInvoice(token, orderId, { onUnauthorized: redirectToLogin });
            setInvoiceEmailState('sent');
        } catch {
            setInvoiceEmailState('failed');
        }
    };

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

    if (loading && !order) {
        return <div className={styles.loading}>Loading order…</div>;
    }

    if (error && !order) {
        return (
            <div className={styles.card}>
                <p className={styles.error} role="alert">{error}</p>
                <Link to="/account/orders" className={styles.secondaryButton}>Back</Link>
            </div>
        );
    }

    if (!order) return null;

    const statusMeta = mapOrderStatus(effectiveStatus);
    const badgeClassName = statusVariantStyles[statusMeta.badgeVariant] ?? styles.statusNeutral;
    const primaryAction = resolveOrderPrimaryAction(effectiveStatus, { hasTracking: Boolean(order?.trackingUrl) });
    const shouldShowPaymentAction = ['continue-payment', 'retry-payment'].includes(primaryAction.type);
    const totals = resolveTotals(order);
    const timeline = resolveTimeline(order, effectiveStatus);
    const humanOrderNumber = order.raw?.orderNumber ?? order.raw?.displayOrderNumber ?? order.id;
    const receiptAvailable = isDocumentAvailable(order, 'receipt');
    const invoiceAvailable = isDocumentAvailable(order, 'invoice');
    const docsDisabled = !receiptAvailable && !invoiceAvailable;
    const tooltip = 'Available after payment confirmation.';
    const fulfillmentType = toStatusKey(order.deliveryType ?? order.raw?.deliveryType).includes('SHIP') ? 'Shipping' : 'Pickup';

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.headerCard}>
                    <div>
                        <p className={styles.kicker}>Order details</p>
                        <h1>Order #{humanOrderNumber}</h1>
                        <p className={styles.subtitle}>Placed on {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</p>
                        {paymentInfo.reference ? (
                            <p className={styles.referenceRow}>
                                Reference: {paymentInfo.reference}
                                <button type="button" className={styles.copyButton} onClick={handleCopyReference}>
                                    {copyState === 'copied' ? 'Copied' : 'Copy'}
                                </button>
                            </p>
                        ) : null}
                    </div>
                    <div className={styles.headerActions}>
                        <span className={`${styles.statusBadge} ${badgeClassName}`}>{statusMeta.label.toUpperCase()}</span>
                        <p className={styles.microcopy}>{statusMeta.description}</p>
                        <div className={styles.actionRow}>
                            <a
                                className={`${styles.primaryButton} ${docsDisabled ? styles.disabled : ''}`}
                                href={`${API_BASE}/api/orders/${encodeURIComponent(order.id)}/receipt`}
                                target="_blank"
                                rel="noreferrer"
                                aria-disabled={docsDisabled}
                                title={docsDisabled ? tooltip : ''}
                                onClick={(event) => docsDisabled && event.preventDefault()}
                            >
                                View receipt
                            </a>
                            <details className={styles.dropdown}>
                                <summary>Invoice</summary>
                                <div className={styles.dropdownMenu}>
                                    <a href={`${API_BASE}/api/orders/${encodeURIComponent(order.id)}/invoice`} target="_blank" rel="noreferrer" onClick={(e) => !invoiceAvailable && e.preventDefault()}>View</a>
                                    <a href={`${API_BASE}/api/orders/${encodeURIComponent(order.id)}/invoice.pdf`} target="_blank" rel="noreferrer" onClick={(e) => !invoiceAvailable && e.preventDefault()}>Download PDF</a>
                                    <button type="button" onClick={handleEmailInvoice} disabled={!invoiceAvailable || invoiceEmailState === 'sending'}>Email me</button>
                                    {!invoiceAvailable ? <small>{tooltip}</small> : null}
                                </div>
                            </details>
                            <button type="button" className={styles.linkButton} onClick={() => window.print()}>Printable order summary</button>
                        </div>
                    </div>
                </div>

                <div className={styles.progressTimeline}>
                    {timeline.map((step) => (
                        <div key={step.label} className={styles.timelineStep}>
                            <span className={`${styles.timelineDot} ${step.state === 'done' ? styles.timelineDone : ''}`} />
                            <span>{step.label}</span>
                        </div>
                    ))}
                </div>

                <div className={styles.layout}>
                    <section className={styles.leftColumn}>
                        <div className={styles.sectionCard}>
                            <h3>Items</h3>
                            {!order.items?.length ? <p className={styles.value}>No items recorded.</p> : (
                                <div className={styles.itemGrid}>
                                    {order.items.map((item, index) => {
                                        const qty = item.quantity ?? item.qty ?? 1;
                                        const unitPrice = item.price ?? item.unitPrice ?? item.amount ?? 0;
                                        const discounted = item.discountedPrice ?? item.priceAfterDiscount;
                                        return (
                                            <div key={item.id ?? item.sku ?? index} className={styles.item}>
                                                <div className={styles.itemThumb} />
                                                <div>
                                                    <p className={styles.itemName}>{item.name ?? item.title ?? 'Item'}</p>
                                                    <p className={styles.itemMeta}>Qty: {qty}</p>
                                                    <p className={styles.itemMeta}>
                                                        {discounted ? <><span className={styles.strike}>{formatCurrency(unitPrice, totals.currency)}</span> {formatCurrency(discounted, totals.currency)}</> : formatCurrency(unitPrice, totals.currency)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className={styles.sectionCard}>
                            <h3>Totals</h3>
                            {loading ? <div className={styles.skeleton} /> : (
                                <dl className={styles.totalsList}>
                                    <div className={styles.totalsRow}><dt>Subtotal</dt><dd>{formatCurrency(totals.subtotal ?? 0, totals.currency)}</dd></div>
                                    <div className={styles.totalsRow}><dt>Discount</dt><dd>-{formatCurrency(totals.discount ?? 0, totals.currency)}</dd></div>
                                    <div className={styles.totalsRow}><dt>{fulfillmentType}</dt><dd>{formatCurrency(totals.shipping ?? 0, totals.currency)}</dd></div>
                                    <div className={styles.totalsRow}><dt>Tax</dt><dd>{formatCurrency(totals.tax ?? 0, totals.currency)}</dd></div>
                                    <div className={`${styles.totalsRow} ${styles.totalRow}`}><dt>Total</dt><dd>{formatCurrency(totals.total ?? 0, totals.currency)}</dd></div>
                                    <div className={styles.totalsRow}><dt>Payment method</dt><dd>{paymentInfo.method || '—'}</dd></div>
                                    <div className={styles.totalsRow}><dt>Payment reference</dt><dd>{paymentInfo.reference || '—'}</dd></div>
                                </dl>
                            )}
                        </div>
                    </section>

                    <aside className={styles.rightColumn}>
                        <div className={styles.sectionCard}>
                            <h3>Fulfillment</h3>
                            <p className={styles.value}>{fulfillmentType}</p>
                            <p className={styles.label}>{fulfillmentType === 'Pickup' ? (order.raw?.pickupLocation || 'Stockholm pickup location shared by email') : formatAddress(order.shippingAddress)}</p>
                        </div>
                        <div className={styles.sectionCard}>
                            <h3>Address</h3>
                            <p className={styles.label}>Shipping: {formatAddress(order.shippingAddress)}</p>
                            <p className={styles.label}>Billing: {formatAddress(order.raw?.billingAddress)}</p>
                        </div>
                        <div className={styles.sectionCard}>
                            <h3>Support & actions</h3>
                            <button type="button" className={styles.secondaryButton} onClick={handleRefreshStatus}>Refresh payment status</button>
                            {shouldShowPaymentAction ? (
                                <button type="button" className={styles.primaryButton} onClick={() => handleOrderPayment(order)} disabled={loadingId === order.id}>
                                    {loadingId === order.id ? 'Opening payment…' : 'Try payment again'}
                                </button>
                            ) : null}
                            <a href="mailto:support@hydroleaf.se" className={styles.linkButton}>Need help?</a>
                            {invoiceEmailState === 'sent' ? <p className={styles.status}>Invoice email sent.</p> : null}
                            {invoiceEmailState === 'failed' ? <p className={styles.error}>Could not email invoice right now.</p> : null}
                        </div>
                    </aside>
                </div>

                {paymentError ? (
                    <div className={styles.error} role="alert">
                        <p>{paymentError}</p>
                        <button type="button" className={styles.secondaryButton} onClick={resetPaymentError}>Dismiss</button>
                    </div>
                ) : null}

                <div className={styles.actions}>
                    <Link to="/account/orders" className={styles.secondaryButton}>Back to orders</Link>
                </div>
            </div>
        </div>
    );
}
