import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
    cancelMyOrder,
    emailOrderInvoice,
    fetchOrderDetail,
    fetchOrderInvoiceHtml,
    fetchOrderInvoicePdf,
    fetchOrderReceiptHtml,
} from '../../api/customer.js';
import DocumentActions from '../../components/orders/DocumentActions.jsx';
import OrderStatusPill from '../../components/orders/OrderStatusPill.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { formatCurrency } from '../../utils/currency.js';
import { canCancelOrder, normalizeOrder } from './orderUtils.js';
import styles from './CustomerOrderDetails.module.css';

const toStatusKey = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const isInvoicePaymentMode = (order) => toStatusKey(order?.paymentMode ?? order?.raw?.paymentMode) === 'INVOICE_PAY_LATER';
const hasIssuedInvoice = (order) => {
    const invoiceNumber = order?.invoiceNumber ?? order?.raw?.invoiceNumber ?? order?.raw?.invoice?.number;
    const invoiceStatus = toStatusKey(order?.invoiceStatus ?? order?.raw?.invoiceStatus ?? order?.raw?.invoice?.status);
    return Boolean(invoiceNumber) || ['ISSUED', 'SENT', 'AVAILABLE'].includes(invoiceStatus);
};
const isBusinessOrder = (order) => {
    const customerType = toStatusKey(order?.customerType ?? order?.raw?.customerType);
    if (customerType === 'B2B' || customerType === 'BUSINESS' || customerType === 'COMPANY') return true;

    return Boolean(
        order?.companyName
        || order?.organizationNumber
        || order?.vatNumber
        || order?.raw?.company?.name
        || order?.raw?.company?.organizationNumber
        || order?.raw?.company?.vatNumber,
    );
};

const formatAddress = (value) => {
    if (!value) return '—';
    if (typeof value === 'string') return value;
    const parts = [value.name ?? value.fullName, value.line1 ?? value.address1, value.line2 ?? value.address2, value.postalCode ?? value.zip, value.city, value.country]
        .filter(Boolean)
        .map((part) => String(part).trim());
    return parts.join(', ') || '—';
};

export default function CustomerOrderDetails() {
    const { orderId } = useParams();
    const { token } = useAuth();
    const { ordersState, loadOrders } = useOutletContext();
    const redirectToLogin = useRedirectToLogin();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [documentState, setDocumentState] = useState({ loading: '', error: '', warning: '', success: '', retryKey: '' });
    const [cancelState, setCancelState] = useState({ open: false, loading: false, error: '' });
    const [toastMessage, setToastMessage] = useState('');

    const existingOrder = useMemo(
        () => (ordersState?.items || []).find((entry) => String(entry.id) === String(orderId)),
        [orderId, ordersState?.items],
    );

    const loadOrderDetails = useCallback(async (signal) => {
        if (!token || !orderId) return null;
        const payload = await fetchOrderDetail(token, orderId, { signal, onUnauthorized: redirectToLogin });
        if (payload === null) return null;
        const normalizedOrder = normalizeOrder(payload);
        setOrder(normalizedOrder);
        return normalizedOrder;
    }, [orderId, redirectToLogin, token]);

    useEffect(() => {
        if (!token || !orderId) return undefined;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        loadOrderDetails(controller.signal)
            .catch((err) => {
                if (err?.name === 'AbortError') return;
                if (err?.isUnsupported) {
                    setError('Order details are not available for this account.');
                    return;
                }
                setError(err?.message || 'Failed to load order details');
                if (existingOrder) setOrder(existingOrder);
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [existingOrder, loadOrderDetails, orderId, token]);

    useEffect(() => {
        if (!toastMessage) return undefined;
        const timeoutId = window.setTimeout(() => setToastMessage(''), 3500);
        return () => window.clearTimeout(timeoutId);
    }, [toastMessage]);

    const activeOrder = order || existingOrder;
    const orderStatusKey = toStatusKey(activeOrder?.orderStatus || activeOrder?.status);
    const isCancelledByCustomer = orderStatusKey === 'CANCELLED_BY_CUSTOMER';
    const canCancelCurrentOrder = canCancelOrder(orderStatusKey);
    const paymentStatus = toStatusKey(activeOrder?.paymentStatus || activeOrder?.orderStatus || activeOrder?.status);
    const paymentFinalized = ['PAID', 'PAYMENT_SUCCEEDED', 'COMPLETED', 'PROCESSING'].includes(paymentStatus);
    const invoiceMode = isInvoicePaymentMode(activeOrder);
    const invoiceIssued = hasIssuedInvoice(activeOrder);
    const invoicePdfAvailable = invoiceMode ? invoiceIssued : paymentFinalized;
    const businessOrder = isBusinessOrder(activeOrder);
    const paymentMethodLabel = invoiceMode
        ? 'Invoice (pay later)'
        : (activeOrder?.paymentMethod || 'Not available yet');
    const paymentReferenceLabel = activeOrder?.paymentReference || 'Not available yet';
    const resolvedPaymentMode = activeOrder?.paymentMode || activeOrder?.raw?.paymentMode || '—';
    const paymentStatusLabel = invoiceMode && paymentStatus !== 'PAID' ? 'UNPAID' : (paymentStatus || 'UNKNOWN');
    const invoiceDueDate = activeOrder?.invoiceDueDate || activeOrder?.raw?.invoiceDueDate || activeOrder?.raw?.invoice?.dueDate || '';
    const bankgiro = activeOrder?.bankgiro || activeOrder?.raw?.bankgiro || activeOrder?.raw?.invoice?.bankgiro || '';
    const invoiceOcr = activeOrder?.invoiceOcr || activeOrder?.raw?.invoiceOcr || activeOrder?.raw?.invoice?.ocr || '';

    const totals = activeOrder?.totals || {};
    const subtotal = totals.subtotal ?? 0;
    const shipping = totals.shipping ?? 0;
    const tax = totals.tax ?? 0;
    const discount = totals.discount ?? 0;
    const total = totals.total ?? activeOrder?.total ?? 0;
    const shouldShowVatRow = tax > 0 || businessOrder;
    const shouldShowVatHint = businessOrder && tax <= 0;

    const openHtml = (html) => {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const popup = window.open(url, '_blank', 'noopener,noreferrer');
        if (!popup) {
            window.URL.revokeObjectURL(url);
            return false;
        }
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        return true;
    };

    const handleDocumentError = (err, key, fallback) => {
        if (err?.status === 401) {
            redirectToLogin();
            return;
        }
        setDocumentState((previous) => ({
            ...previous,
            loading: '',
            success: '',
            warning: '',
            retryKey: key,
            error: err?.message || fallback,
        }));
    };

    const runDocumentAction = async (key) => {
        if (!token || !orderId) return;
        setDocumentState({ loading: key, error: '', warning: '', success: '', retryKey: key });
        try {
            if (key === 'receipt') {
                const html = await fetchOrderReceiptHtml(token, orderId, { onUnauthorized: redirectToLogin });
                if (html && !openHtml(html)) {
                    setDocumentState({
                        loading: '',
                        error: '',
                        warning: 'Please allow popups to view this document.',
                        success: '',
                        retryKey: key,
                    });
                    return;
                }
            }
            if (key === 'invoice') {
                const html = await fetchOrderInvoiceHtml(token, orderId, { onUnauthorized: redirectToLogin });
                if (html && !openHtml(html)) {
                    setDocumentState({
                        loading: '',
                        error: '',
                        warning: 'Please allow popups to view this document.',
                        success: '',
                        retryKey: key,
                    });
                    return;
                }
            }
            if (key === 'download-pdf' || key === 'open-pdf') {
                const result = await fetchOrderInvoicePdf(token, orderId, { onUnauthorized: redirectToLogin });
                if (result) {
                    const { blob, fileName } = result;
                    const url = window.URL.createObjectURL(blob);
                    if (key === 'download-pdf') {
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                    } else {
                        const popup = window.open(url, '_blank', 'noopener,noreferrer');
                        if (!popup) {
                            window.URL.revokeObjectURL(url);
                            setDocumentState({
                                loading: '',
                                error: '',
                                warning: 'Please allow popups to open this PDF.',
                                success: '',
                                retryKey: key,
                            });
                            return;
                        }
                        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
                    }
                }
            }
            if (key === 'email-invoice') {
                await emailOrderInvoice(token, orderId, { onUnauthorized: redirectToLogin });
                setDocumentState({ loading: '', error: '', warning: '', success: 'Invoice email sent.', retryKey: '' });
                return;
            }
            setDocumentState({ loading: '', error: '', warning: '', success: '', retryKey: '' });
        } catch (err) {
            handleDocumentError(err, key, 'Could not complete this document action right now.');
        }
    };

    const handleCancelOrder = async () => {
        if (!token || !orderId || !canCancelCurrentOrder || cancelState.loading) return;
        setCancelState((prev) => ({ ...prev, loading: true, error: '' }));
        try {
            const payload = await cancelMyOrder(token, orderId, { onUnauthorized: redirectToLogin });
            if (payload) {
                setOrder(normalizeOrder(payload));
            } else {
                setOrder((prev) => (prev ? { ...prev, status: 'CANCELLED_BY_CUSTOMER' } : prev));
            }
            await loadOrderDetails();
            await loadOrders?.({ silent: true });
            setToastMessage('Order cancelled.');
            setCancelState({ open: false, loading: false, error: '' });
        } catch (err) {
            setCancelState((prev) => ({
                ...prev,
                loading: false,
                error: err?.status === 409
                    ? (err?.message || 'Could not cancel the order right now.')
                    : 'Could not cancel the order right now.',
            }));
        }
    };

    if (loading && !activeOrder) return <div className={styles.card}>Loading order details…</div>;
    if (error && !activeOrder) return <div className={styles.card}><p className={styles.error}>{error}</p><Link to="/account/orders">Back</Link></div>;

    const documentActions = [
        {
            key: 'receipt',
            label: 'View receipt',
            helper: 'Opens in a new tab.',
            disabled: !paymentFinalized || (invoiceMode && paymentStatus !== 'PAID'),
            reason: !paymentFinalized ? 'Available after payment confirmation.' : 'Available after invoice payment is completed.',
            loading: documentState.loading === 'receipt',
            variant: 'primary',
            onClick: () => runDocumentAction('receipt'),
        },
        {
            key: 'invoice',
            label: invoiceMode ? 'View invoice' : 'Invoice document',
            helper: invoiceMode ? 'HTML invoice opens in a new tab.' : 'Invoice is available for invoice/pay-later orders.',
            disabled: !invoiceMode && !paymentFinalized,
            reason: !invoiceMode && !paymentFinalized ? 'Available after payment confirmation if an invoice document exists.' : '',
            loading: documentState.loading === 'invoice',
            variant: 'primary',
            onClick: () => runDocumentAction('invoice'),
        },
        {
            key: 'download-pdf',
            label: 'Download PDF',
            helper: 'Downloads to your device.',
            disabled: !invoicePdfAvailable,
            reason: invoiceMode ? 'Available once the invoice is issued.' : 'Available after payment confirmation.',
            loading: documentState.loading === 'download-pdf',
            variant: 'secondary',
            onClick: () => runDocumentAction('download-pdf'),
        },
        {
            key: 'open-pdf',
            label: 'Open PDF',
            helper: 'PDF opens in a new tab.',
            disabled: !invoicePdfAvailable,
            reason: invoiceMode ? 'Available once the invoice is issued.' : 'Available after payment confirmation.',
            loading: documentState.loading === 'open-pdf',
            variant: 'secondary',
            onClick: () => runDocumentAction('open-pdf'),
        },
        {
            key: 'email-invoice',
            label: 'Email invoice',
            helper: 'Sends invoice to your account email.',
            disabled: !invoiceMode && !paymentFinalized,
            reason: !invoiceMode && !paymentFinalized ? 'Available after payment confirmation.' : '',
            loading: documentState.loading === 'email-invoice',
            variant: 'outline',
            onClick: () => runDocumentAction('email-invoice'),
        },
    ].filter((action) => {
        if (!isCancelledByCustomer) return true;
        return !['invoice', 'email-invoice'].includes(action.key);
    });

    return (
        <div className={styles.page}>
            <div className={styles.summaryHeader}>
                <div>
                    <h1>Order #{activeOrder?.orderNumber || activeOrder?.id}</h1>
                    <p>Placed {activeOrder?.createdAt ? new Date(activeOrder.createdAt).toLocaleString() : '—'}</p>
                </div>
                <OrderStatusPill status={activeOrder?.status} />
                <div className={styles.totalBlock}>
                    <span>Total</span>
                    <strong>{formatCurrency(total, activeOrder?.currency)}</strong>
                </div>
                <div className={styles.metaBlock}>
                    <p><strong>Payment:</strong> {paymentMethodLabel}</p>
                    <p><strong>Reference:</strong> {paymentReferenceLabel}</p>
                    <p><strong>Delivery:</strong> {activeOrder?.deliveryType || 'Pickup'}</p>
                </div>
                {canCancelCurrentOrder ? (
                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={() => setCancelState((prev) => ({ ...prev, open: true, error: '' }))}
                        >
                            Cancel order
                        </button>
                    </div>
                ) : null}
            </div>

            <div className={styles.layout}>
                <main className={styles.left}>
                    <section className={styles.card}>
                        <h2>Items</h2>
                        <div className={styles.items}>
                            {(activeOrder?.items || []).map((item, index) => (
                                <article key={`${item.name}-${index}`} className={styles.itemRow}>
                                    <div className={styles.thumb}>Image</div>
                                    <div>
                                        <p className={styles.itemName}>{item.name}</p>
                                        <p className={styles.muted}>Qty {item.quantity} · {formatCurrency(item.price, activeOrder?.currency)} each</p>
                                    </div>
                                    <strong>{formatCurrency(item.lineTotal, activeOrder?.currency)}</strong>
                                </article>
                            ))}
                        </div>
                    </section>
                    {activeOrder?.customerNote ? <section className={styles.card}><h2>Notes</h2><p>{activeOrder.customerNote}</p></section> : null}
                </main>

                <aside className={styles.right}>
                    <section className={styles.card}>
                        <h3>Totals</h3>
                        <p>Subtotal <strong>{formatCurrency(subtotal, activeOrder?.currency)}</strong></p>
                        {shouldShowVatRow ? (
                            <p>
                                VAT (moms) <strong>{formatCurrency(tax, activeOrder?.currency)}</strong>
                                {shouldShowVatHint ? <span className={styles.neutral}> · VAT will be shown on invoice</span> : null}
                            </p>
                        ) : null}
                        <p>Shipping <strong>{formatCurrency(shipping, activeOrder?.currency)}</strong></p>
                        <p>Discount <strong>-{formatCurrency(discount, activeOrder?.currency)}</strong></p>
                        <p className={styles.totalRow}>Total <strong>{formatCurrency(total, activeOrder?.currency)}</strong></p>
                    </section>

                    <section className={styles.card}>
                        <h3>Documents</h3>
                        {isCancelledByCustomer ? <p className={styles.neutral}>Cancelled orders are read-only.</p> : null}
                        <DocumentActions
                            actions={documentActions}
                            error={documentState.error}
                            warning={documentState.warning}
                            success={documentState.success}
                            onRetry={() => runDocumentAction(documentState.retryKey)}
                        />
                    </section>

                    <section className={styles.card}>
                        <h3>Delivery</h3>
                        <p>{formatAddress(activeOrder?.shippingAddress)}</p>
                    </section>

                    <section className={styles.card}>
                        <h3>Payment</h3>
                        <p><strong>Method:</strong> {paymentMethodLabel}</p>
                        <p><strong>Mode:</strong> {resolvedPaymentMode}</p>
                        <p><strong>Payment status:</strong> {paymentStatusLabel}</p>
                        <p><strong>Reference:</strong> {paymentReferenceLabel}</p>
                        {invoiceMode ? (
                            <>
                                <p><strong>Bankgiro:</strong> {bankgiro || 'Pending'}</p>
                                <p><strong>OCR:</strong> {invoiceOcr || 'Pending'}</p>
                                <p><strong>Due date:</strong> {invoiceDueDate ? new Date(invoiceDueDate).toLocaleDateString() : 'Pending'}</p>
                            </>
                        ) : null}
                        {!activeOrder?.raw?.payment ? <p className={styles.neutral}>Payment confirmed but provider details not available yet.</p> : null}
                    </section>
                </aside>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
            {cancelState.error ? <p className={styles.error}>{cancelState.error}</p> : null}
            {toastMessage ? (
                <div className={styles.toast} role="status" aria-live="polite">
                    {toastMessage}
                </div>
            ) : null}
            <Link to="/account/orders" className={styles.backButton}>Back to orders</Link>

            {cancelState.open ? (
                <div className={styles.modalBackdrop} role="presentation" onClick={() => setCancelState((prev) => ({ ...prev, open: false }))}>
                    <div
                        className={styles.modalPanel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cancel-order-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 id="cancel-order-title">Cancel order?</h3>
                        <p>This cannot be undone.</p>
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.modalSecondary}
                                onClick={() => setCancelState((prev) => ({ ...prev, open: false }))}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={styles.modalDanger}
                                onClick={handleCancelOrder}
                                disabled={cancelState.loading}
                            >
                                {cancelState.loading ? 'Cancelling…' : 'Confirm cancellation'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
