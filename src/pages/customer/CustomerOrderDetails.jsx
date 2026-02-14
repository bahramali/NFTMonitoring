import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
    emailOrderInvoice,
    fetchOrderDetail,
    fetchOrderInvoiceHtml,
    fetchOrderInvoicePdf,
    fetchOrderReceiptHtml,
} from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import useOrderPaymentAction from '../../hooks/useOrderPaymentAction.js';
import { mapOrderStatus, resolveOrderPrimaryAction } from '../../utils/orderStatus.js';
import { formatCurrency } from '../../utils/currency.js';
import { normalizeOrder } from './orderUtils.js';
import styles from './CustomerOrderDetails.module.css';

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
            value.name ?? value.fullName,
            value.line1 ?? value.address1,
            value.line2 ?? value.address2,
            value.postalCode ?? value.zip,
            value.city,
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
    const normalizedTotals = order?.totals ?? {};
    const totals = raw.totals ?? raw.summary ?? raw.amounts ?? {};
    const fallbackSubtotal = Array.isArray(order?.items)
        ? order.items.reduce((sum, item) => {
            const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1;
            const unitPrice = Number(item?.price ?? item?.unitPrice ?? item?.amount ?? 0) || 0;
            const lineTotal = item?.lineTotal ?? item?.total;
            return sum + (lineTotal != null ? Number(lineTotal) || 0 : quantity * unitPrice);
        }, 0)
        : null;

    const subtotal = normalizedTotals.subtotal
        ?? raw.subtotal
        ?? raw.subTotal
        ?? totals.subtotal
        ?? totals.subTotal
        ?? raw.itemsSubtotal
        ?? raw.itemsTotal
        ?? fallbackSubtotal;
    const shipping = normalizedTotals.shipping ?? raw.shipping ?? raw.shippingTotal ?? totals.shipping ?? totals.shippingTotal ?? raw.deliveryFee ?? 0;
    const tax = normalizedTotals.tax ?? raw.tax ?? raw.taxTotal ?? totals.tax ?? totals.taxTotal ?? 0;
    const discount = normalizedTotals.discount ?? raw.discount ?? raw.discountTotal ?? totals.discount ?? totals.discountTotal ?? raw.promoDiscount ?? 0;
    const total = normalizedTotals.total
        ?? order?.total
        ?? totals.total
        ?? raw.total
        ?? (subtotal != null ? subtotal + shipping + tax - discount : null);

    return {
        currency: order?.currency ?? normalizedTotals.currency ?? totals.currency ?? raw.currency ?? 'SEK',
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
    const methodBase =
        order?.paymentMethod
        ?? raw.paymentMethod
        ?? payment.method
        ?? payment.brand
        ?? payment.type
        ?? raw.payment_type
        ?? '';
    const last4 = payment.last4 ?? raw.paymentMethodLast4 ?? raw.last4 ?? '';
    const reference =
        order?.paymentReference
        ?? raw.paymentReference
        ?? payment.reference
        ?? payment.id
        ?? payment.intentId
        ?? payment.transactionId
        ?? raw.paymentIntentId
        ?? '';

    return {
        status: order?.paymentStatus ?? payment.status ?? raw.paymentStatus ?? raw.payment_state ?? order?.status ?? '',
        method: last4 ? `${methodBase} •••• ${last4}`.trim() : methodBase,
        reference,
    };
};

const displayPaymentValue = (value) => {
    if (value == null) return 'Unknown';
    const normalized = String(value).trim();
    return normalized || 'Unknown';
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

const resolveDocument = (order, key) => {
    const raw = order?.raw ?? {};
    const status = toStatusKey(order?.paymentStatus ?? order?.status);
    const available = Boolean(
        raw?.documents?.[key]?.available
        ?? raw?.[`${key}Available`]
        ?? raw?.payment?.[`${key}Available`]
        ?? (key === 'receipt' && ['PAID', 'PAYMENT_SUCCEEDED'].includes(status)),
    );
    const reason = raw?.documents?.[key]?.reason ?? (available ? '' : 'Available after payment confirmation.');
    return { available, reason };
};

export default function CustomerOrderDetails() {
    const { orderId } = useParams();
    const { token } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const { ordersState } = useOutletContext();
    const { error: paymentError, loadingId, handleOrderPayment, resetError: resetPaymentError } = useOrderPaymentAction();

    const existingOrder = useMemo(
        () => (ordersState?.items || []).find((entry) => String(entry.id) === String(orderId)),
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
    const [documentState, setDocumentState] = useState({ loading: '', error: '' });

    useEffect(() => {
        if (!token || !orderId) return undefined;
        if (ordersState.supported === false) {
            setUnsupported(true);
            return undefined;
        }

        const controller = new AbortController();
        const load = async () => {
            setLoading((prev) => (existingOrder ? prev : true));
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
    }, [existingOrder, orderId, ordersState.supported, pollStartedAt, redirectToLogin, refreshTick, token]);

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

    const handleDocumentError = (err, fallbackMessage) => {
        if (err?.status === 401) {
            redirectToLogin();
            return;
        }
        if (err?.status === 404 || err?.status === 409) {
            setDocumentState({ loading: '', error: err?.message || fallbackMessage });
            return;
        }
        setDocumentState({ loading: '', error: fallbackMessage });
    };

    const openHtmlDocument = (html, title) => {
        const popup = window.open('', '_blank', 'noopener,noreferrer');
        if (!popup) {
            setDocumentState({ loading: '', error: 'Please allow popups to view this document.' });
            return;
        }
        popup.document.open();
        popup.document.write(html || `<html><body><h1>${title}</h1><p>No document content.</p></body></html>`);
        popup.document.close();
    };

    const handleViewReceipt = async () => {
        if (!token || !orderId || !receipt.available) return;
        setDocumentState({ loading: 'receipt', error: '' });
        try {
            const html = await fetchOrderReceiptHtml(token, orderId, { onUnauthorized: redirectToLogin });
            if (html === null) return;
            openHtmlDocument(html, 'Receipt');
            setDocumentState({ loading: '', error: '' });
        } catch (err) {
            handleDocumentError(err, 'Could not open receipt right now.');
        }
    };

    const handleViewInvoice = async () => {
        if (!token || !orderId || !invoice.available) return;
        setDocumentState({ loading: 'invoice', error: '' });
        try {
            const html = await fetchOrderInvoiceHtml(token, orderId, { onUnauthorized: redirectToLogin });
            if (html === null) return;
            openHtmlDocument(html, 'Invoice');
            setDocumentState({ loading: '', error: '' });
        } catch (err) {
            handleDocumentError(err, 'Could not open invoice right now.');
        }
    };

    const handleDownloadInvoicePdf = async () => {
        if (!token || !orderId || !invoice.available) return;
        setDocumentState({ loading: 'invoice-pdf', error: '' });
        try {
            const result = await fetchOrderInvoicePdf(token, orderId, { onUnauthorized: redirectToLogin });
            if (!result) return;
            const { blob, fileName } = result;
            const url = window.URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = url;
            link.download = fileName;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            setDocumentState({ loading: '', error: '' });
        } catch (err) {
            handleDocumentError(err, 'Could not download invoice PDF right now.');
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
        return (
            <div className={styles.page}>
                <div className={styles.card}>
                    <div className={styles.skeletonBlock} />
                    <div className={styles.skeletonBlock} />
                </div>
            </div>
        );
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
    const receipt = resolveDocument(order, 'receipt');
    const invoice = resolveDocument(order, 'invoice');
    const fulfillmentType = toStatusKey(order.deliveryType ?? order.raw?.deliveryType).includes('SHIP') ? 'Shipping' : 'Pickup';
    const hasItems = Boolean(order.items?.length);
    const paymentMethodDisplay = displayPaymentValue(paymentInfo.method);
    const paymentReferenceDisplay = displayPaymentValue(paymentInfo.reference);
    const showMissingProviderDetailsWarning = toStatusKey(paymentInfo.status) === 'PAID'
        && (!paymentInfo.reference || !paymentInfo.method);

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
                        <span className={`${styles.statusBadge} ${badgeClassName}`}>{statusMeta.label}</span>
                        <p className={styles.microcopy}>{statusMeta.description}</p>
                        {shouldShowPaymentAction ? (
                            <button type="button" className={styles.primaryButton} onClick={() => handleOrderPayment(order)} disabled={loadingId === order.id}>
                                {loadingId === order.id ? 'Opening payment…' : 'Complete payment'}
                            </button>
                        ) : null}
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

                {!hasItems ? <p className={styles.warning}>We’re missing item details for this order.</p> : null}

                <div className={styles.layout}>
                    <section className={styles.leftColumn}>
                        <div className={styles.sectionCard}>
                            <h3>Items</h3>
                            {!hasItems ? <p className={styles.value}>No items recorded.</p> : (
                                <div className={styles.itemGrid}>
                                    {order.items.map((item, index) => {
                                        const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
                                        const unitPrice = Number(item.price ?? item.unitPrice ?? item.amount ?? 0) || 0;
                                        const lineTotal = Number(item.lineTotal ?? item.total ?? (unitPrice * qty)) || 0;
                                        return (
                                            <div key={item.id ?? item.sku ?? index} className={styles.item}>
                                                <div className={styles.itemThumb} aria-hidden="true">IMG</div>
                                                <div className={styles.itemBody}>
                                                    <p className={styles.itemName}>{item.name ?? item.title ?? 'Item'}</p>
                                                    <p className={styles.itemMeta}>Qty: {qty}</p>
                                                    <p className={styles.itemMeta}>Unit: {formatCurrency(unitPrice, totals.currency)}</p>
                                                </div>
                                                <p className={styles.itemLineTotal}>{formatCurrency(lineTotal, totals.currency)}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className={styles.rightColumn}>
                        <div className={styles.sectionCard}>
                            <h3>Totals ({totals.currency})</h3>
                            <dl className={styles.totalsList}>
                                <div className={styles.totalsRow}><dt>Subtotal</dt><dd>{formatCurrency(totals.subtotal ?? 0, totals.currency)}</dd></div>
                                <div className={styles.totalsRow}><dt>Discount</dt><dd>-{formatCurrency(totals.discount ?? 0, totals.currency)}</dd></div>
                                <div className={styles.totalsRow}><dt>Shipping</dt><dd>{formatCurrency(totals.shipping ?? 0, totals.currency)}</dd></div>
                                <div className={styles.totalsRow}><dt>Tax</dt><dd>{formatCurrency(totals.tax ?? 0, totals.currency)}</dd></div>
                                <div className={`${styles.totalsRow} ${styles.totalRow}`}><dt>Total</dt><dd>{formatCurrency(totals.total ?? 0, totals.currency)}</dd></div>
                            </dl>
                        </div>

                        <div className={styles.sectionCard}>
                            <h3>Fulfillment & address</h3>
                            <p className={styles.value}>{fulfillmentType}</p>
                            <p className={styles.label}>{fulfillmentType === 'Pickup' ? (order.raw?.pickupLocation || 'Pickup location shared by email') : formatAddress(order.shippingAddress)}</p>
                            {order.raw?.trackingUrl || order.trackingUrl ? (
                                <a className={styles.linkButton} href={order.raw?.trackingUrl ?? order.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a>
                            ) : null}
                            <p className={styles.label}>Billing: {formatAddress(order.raw?.billingAddress)}</p>
                        </div>

                        <div className={styles.sectionCard}>
                            <h3>Documents</h3>
                            <div className={styles.documentRow}>
                                <button
                                    type="button"
                                    className={`${styles.secondaryButton} ${!receipt.available ? styles.disabled : ''}`}
                                    onClick={handleViewReceipt}
                                    disabled={!receipt.available || documentState.loading === 'receipt'}
                                >
                                    {documentState.loading === 'receipt' ? 'Opening receipt…' : 'View receipt'}
                                </button>
                                {!receipt.available ? <small>{receipt.reason}</small> : null}
                            </div>
                            <div className={styles.documentRow}>
                                <button
                                    type="button"
                                    className={`${styles.secondaryButton} ${!invoice.available ? styles.disabled : ''}`}
                                    onClick={handleViewInvoice}
                                    disabled={!invoice.available || documentState.loading === 'invoice'}
                                >
                                    {documentState.loading === 'invoice' ? 'Opening invoice…' : 'View invoice'}
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.secondaryButton} ${!invoice.available ? styles.disabled : ''}`}
                                    onClick={handleDownloadInvoicePdf}
                                    disabled={!invoice.available || documentState.loading === 'invoice-pdf'}
                                >
                                    {documentState.loading === 'invoice-pdf' ? 'Downloading PDF…' : 'Download PDF'}
                                </button>
                                <button type="button" className={styles.secondaryButton} onClick={handleEmailInvoice} disabled={!invoice.available || invoiceEmailState === 'sending'}>
                                    Email invoice
                                </button>
                                {!invoice.available ? <small>{invoice.reason}</small> : null}
                            </div>
                            {documentState.error ? <p className={styles.error}>{documentState.error}</p> : null}
                            {invoiceEmailState === 'sent' ? <p className={styles.status}>Invoice email sent.</p> : null}
                            {invoiceEmailState === 'failed' ? <p className={styles.error}>Could not email invoice right now.</p> : null}
                        </div>

                        <div className={styles.sectionCard}>
                            <h3>Payment</h3>
                            <p className={styles.label}><strong>Payment Method:</strong> {paymentMethodDisplay}</p>
                            <p className={styles.label}><strong>Reference:</strong> {paymentReferenceDisplay}</p>
                            {showMissingProviderDetailsWarning ? (
                                <p className={styles.warning}>Payment confirmed, but provider details are not available yet.</p>
                            ) : null}
                            <button type="button" className={styles.secondaryButton} onClick={handleRefreshStatus}>Refresh payment status</button>
                            <a href="mailto:support@hydroleaf.se" className={styles.linkButton}>Need help?</a>
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
                    <button type="button" className={styles.linkButton} onClick={() => window.print()}>Printable order summary</button>
                    <Link to="/account/orders" className={styles.secondaryButton}>Back to orders</Link>
                </div>
            </div>
        </div>
    );
}
