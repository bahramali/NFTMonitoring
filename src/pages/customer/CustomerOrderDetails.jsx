import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
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
import { normalizeOrder } from './orderUtils.js';
import styles from './CustomerOrderDetails.module.css';

const toStatusKey = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const isInvoicePaymentMode = (order) => toStatusKey(order?.paymentMode ?? order?.raw?.paymentMode) === 'INVOICE_PAY_LATER';

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
    const { ordersState } = useOutletContext();
    const redirectToLogin = useRedirectToLogin();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [documentState, setDocumentState] = useState({ loading: '', error: '', warning: '', success: '', retryKey: '' });

    const existingOrder = useMemo(
        () => (ordersState?.items || []).find((entry) => String(entry.id) === String(orderId)),
        [orderId, ordersState?.items],
    );

    useEffect(() => {
        if (!token || !orderId) return undefined;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        fetchOrderDetail(token, orderId, { signal: controller.signal, onUnauthorized: redirectToLogin })
            .then((payload) => {
                if (payload === null) return;
                setOrder(normalizeOrder(payload));
            })
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
    }, [existingOrder, orderId, redirectToLogin, token]);

    const activeOrder = order || existingOrder;
    const paymentStatus = toStatusKey(activeOrder?.paymentStatus || activeOrder?.status);
    const paymentFinalized = ['PAID', 'PAYMENT_SUCCEEDED', 'COMPLETED', 'PROCESSING'].includes(paymentStatus);
    const invoiceMode = isInvoicePaymentMode(activeOrder);

    const totals = activeOrder?.totals || {};
    const subtotal = totals.subtotal ?? 0;
    const shipping = totals.shipping ?? 0;
    const tax = totals.tax ?? 0;
    const discount = totals.discount ?? 0;
    const total = totals.total ?? activeOrder?.total ?? 0;

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
            label: 'View invoice',
            helper: 'HTML invoice opens in a new tab.',
            disabled: !invoiceMode && !paymentFinalized,
            reason: !invoiceMode && !paymentFinalized ? 'Available after payment confirmation.' : '',
            loading: documentState.loading === 'invoice',
            variant: 'primary',
            onClick: () => runDocumentAction('invoice'),
        },
        {
            key: 'download-pdf',
            label: 'Download PDF',
            helper: 'Downloads to your device.',
            disabled: !paymentFinalized,
            reason: 'Available after payment confirmation.',
            loading: documentState.loading === 'download-pdf',
            variant: 'secondary',
            onClick: () => runDocumentAction('download-pdf'),
        },
        {
            key: 'open-pdf',
            label: 'Open PDF',
            helper: 'PDF opens in a new tab.',
            disabled: !paymentFinalized,
            reason: 'Available after payment confirmation.',
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
    ];

    return (
        <div className={styles.page}>
            <div className={styles.summaryHeader}>
                <div>
                    <h1>Order #{activeOrder?.id}</h1>
                    <p>Placed {activeOrder?.createdAt ? new Date(activeOrder.createdAt).toLocaleString() : '—'}</p>
                </div>
                <OrderStatusPill status={activeOrder?.status} />
                <div className={styles.totalBlock}>
                    <span>Total</span>
                    <strong>{formatCurrency(total, activeOrder?.currency)}</strong>
                </div>
                <div className={styles.metaBlock}>
                    <p><strong>Payment:</strong> {activeOrder?.paymentMethod || '—'}</p>
                    <p><strong>Reference:</strong> {activeOrder?.paymentReference || '—'}</p>
                    <p><strong>Delivery:</strong> {activeOrder?.deliveryType || 'Pickup'}</p>
                </div>
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
                        <p>VAT <strong>{formatCurrency(tax, activeOrder?.currency)}</strong></p>
                        <p>Shipping <strong>{formatCurrency(shipping, activeOrder?.currency)}</strong></p>
                        <p>Discount <strong>-{formatCurrency(discount, activeOrder?.currency)}</strong></p>
                        <p className={styles.totalRow}>Total <strong>{formatCurrency(total, activeOrder?.currency)}</strong></p>
                    </section>

                    <section className={styles.card}>
                        <h3>Documents</h3>
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
                        <p><strong>Method:</strong> {activeOrder?.paymentMethod || '—'}</p>
                        <p><strong>Mode:</strong> {activeOrder?.paymentMode || 'PAY_NOW'}</p>
                        <p><strong>Reference:</strong> {activeOrder?.paymentReference || '—'}</p>
                        {!activeOrder?.raw?.payment ? <p className={styles.neutral}>Payment confirmed but provider details not available yet.</p> : null}
                    </section>
                </aside>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
            <Link to="/account/orders" className={styles.backButton}>Back to orders</Link>
        </div>
    );
}
