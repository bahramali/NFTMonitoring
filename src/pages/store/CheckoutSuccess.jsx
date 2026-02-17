import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchOrderStatus, fetchStoreOrderBySession } from '../../api/store.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { mapOrderStatus } from '../../utils/orderStatus.js';
import styles from './CheckoutReturn.module.css';

const resolveOrderStatus = (order) => (
    order?.paymentStatus
    ?? order?.status
    ?? order?.state
    ?? order?.payment_state
    ?? 'Unknown'
);

const isPaidStatus = (status) => {
    if (!status) return false;
    const normalized = `${status}`.toLowerCase();
    return ['paid', 'confirmed', 'succeeded', 'complete', 'completed'].includes(normalized);
};

const isFailedStatus = (status) => {
    if (!status) return false;
    const normalized = `${status}`.toLowerCase();
    return ['failed', 'canceled', 'cancelled'].includes(normalized);
};

const isPendingStatus = (status) => {
    if (!status) return true;
    const normalized = `${status}`.toLowerCase();
    return ['pending', 'processing', 'requires_payment_method', 'requires_action', 'unpaid', 'open'].includes(normalized);
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 60000;
const MAX_SERVER_ERROR_ATTEMPTS = 3;
const MAX_POLL_BACKOFF_MS = 10000;

const resolveRetryAfterMs = (payload) => {
    const candidate = payload?.retryAfter ?? payload?.retry_after ?? payload?.pollAfterMs ?? payload?.poll_after_ms;
    const value = Number(candidate);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value >= 1000 ? value : value * 1000;
};

const isTerminalClientError = (error) => {
    const status = Number(error?.status);
    if (!Number.isFinite(status) || status < 400 || status >= 500) return false;
    const message = `${error?.message || ''}`.toLowerCase();
    const code = `${error?.code || error?.payload?.code || error?.payload?.error?.code || ''}`.toUpperCase();
    return code === 'CART_CLOSED'
        || message.includes('cart is no longer open')
        || message.includes('no longer open')
        || status === 401
        || status === 403
        || status === 404
        || status === 409;
};

const normalizeOrderPayload = (payload) => {
    if (!payload) return null;
    if (Array.isArray(payload)) return payload[0] ?? null;
    if (payload?.order) return payload.order;
    if (Array.isArray(payload?.orders)) return payload.orders[0] ?? null;
    if (Array.isArray(payload?.content)) return payload.content[0] ?? null;
    return payload;
};

export default function CheckoutSuccess() {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const orderId = searchParams.get('order_id');
    const selectedPaymentMode = searchParams.get('payment_mode');
    const hintedInvoiceNumber = searchParams.get('invoice_number');
    const hintedInvoiceDueDate = searchParams.get('invoice_due_date');
    const { clearCart } = useStorefront();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [timedOut, setTimedOut] = useState(false);
    const [pollingStopped, setPollingStopped] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [httpStatus, setHttpStatus] = useState(null);
    const [referenceId, setReferenceId] = useState(null);
    const timeoutRef = useRef(null);
    const requestControllerRef = useRef(null);
    const orderRef = useRef(null);
    const retryCountRef = useRef(0);
    const [retrySeed, setRetrySeed] = useState(0);

    useEffect(() => {
        if (sessionId) {
            console.info('Checkout success session observed.', { sessionId });
        }
        if (orderId) {
            console.info('Checkout success order observed.', { orderId });
        }
    }, [orderId, sessionId]);

    useEffect(() => {
        if (!referenceId) return;
        console.info('Checkout status request correlation id received.', { correlationId: referenceId });
    }, [referenceId]);

    const handleRetry = () => {
        setIsRetrying(true);
        setRetrySeed((value) => value + 1);
    };

    useEffect(() => {
        if (!sessionId && !orderId) return;
        let isMounted = true;
        const startedAt = Date.now();
        let serverErrorCount = 0;
        setTimedOut(false);
        setPollingStopped(false);
        setHttpStatus(null);
        setError(null);
        setNotFound(false);
        setOrder(null);
        orderRef.current = null;
        retryCountRef.current = 0;
        setIsRetrying(false);

        const stopPolling = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            if (requestControllerRef.current) {
                requestControllerRef.current.abort();
                requestControllerRef.current = null;
            }
            setPollingStopped(true);
        };

        const poll = async () => {
            if (!isMounted) return;
            requestControllerRef.current = new AbortController();
            setLoading(true);
            let latestOrder = null;
            let latestHttpStatus = null;
            try {
                const response = sessionId
                    ? await fetchStoreOrderBySession(sessionId, { signal: requestControllerRef.current.signal })
                    : await fetchOrderStatus(orderId, { signal: requestControllerRef.current.signal });
                const { data, correlationId, status: responseStatus } = response;
                if (!isMounted) return;
                latestHttpStatus = responseStatus ?? 200;
                setHttpStatus(responseStatus ?? 200);
                latestOrder = normalizeOrderPayload(data);
                setOrder(latestOrder);
                orderRef.current = latestOrder;
                setError(null);
                setNotFound(false);
                serverErrorCount = 0;
                const paymentMode = `${latestOrder?.paymentMode ?? latestOrder?.payment_mode ?? selectedPaymentMode ?? ''}`.toUpperCase();
                const isInvoiceFlow = paymentMode === 'INVOICE_PAY_LATER';
                if (isInvoiceFlow) {
                    stopPolling();
                    return;
                }
                if (correlationId) {
                    setReferenceId((prev) => (prev === correlationId ? prev : correlationId));
                }
            } catch (err) {
                if (!isMounted || err?.name === 'AbortError') return;
                latestHttpStatus = err?.status ?? null;
                setHttpStatus(err?.status ?? null);
                if (err?.status === 404) {
                    setNotFound(true);
                }
                if (err?.correlationId) {
                    setReferenceId((prev) => (prev === err.correlationId ? prev : err.correlationId));
                }

                if (isTerminalClientError(err)) {
                    if (err?.status === 401 || err?.status === 403) {
                        setError('Please sign in again to view your order status.');
                    } else {
                        setError(err?.status === 404 ? null : (err?.message || 'Unable to load order status.'));
                    }
                    stopPolling();
                    return;
                }

                if (err?.status >= 500) {
                    serverErrorCount += 1;
                    if (serverErrorCount >= MAX_SERVER_ERROR_ATTEMPTS) {
                        setError('Unable to confirm payment right now. Please try again.');
                        stopPolling();
                        return;
                    }
                }
            } finally {
                requestControllerRef.current = null;
                if (isMounted) {
                    setLoading(false);
                }
            }

            const status = resolveOrderStatus(latestOrder ?? orderRef.current);
            const elapsed = Date.now() - startedAt;
            const shouldContinue = elapsed < MAX_POLL_DURATION_MS
                && !isPaidStatus(status)
                && !isFailedStatus(status);

            if (shouldContinue) {
                const baseDelay = POLL_INTERVAL_MS;
                const retryAfterMs = latestHttpStatus === 202 ? resolveRetryAfterMs(latestOrder ?? orderRef.current) : null;
                const backoffDelay = latestHttpStatus === 202
                    ? Math.min(baseDelay * (2 ** retryCountRef.current), MAX_POLL_BACKOFF_MS)
                    : baseDelay;
                const pollDelay = retryAfterMs ?? backoffDelay;
                timeoutRef.current = setTimeout(poll, pollDelay);
                retryCountRef.current = latestHttpStatus === 202 ? retryCountRef.current + 1 : 0;
            } else if (!isMounted) {
                return;
            } else if (elapsed >= MAX_POLL_DURATION_MS) {
                setTimedOut(true);
                setError('We are still processing your payment. Please retry in a moment.');
                stopPolling();
            } else {
                stopPolling();
            }
        };

        poll();

        return () => {
            isMounted = false;
            if (requestControllerRef.current) {
                requestControllerRef.current.abort();
                requestControllerRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [orderId, retrySeed, selectedPaymentMode, sessionId]);

    const status = useMemo(() => resolveOrderStatus(order), [order]);
    const resolvedPaymentMode = (
        order?.paymentMode
        ?? order?.payment_mode
        ?? order?.invoice?.paymentMode
        ?? selectedPaymentMode
        ?? ''
    );
    const isInvoiceFlow = `${resolvedPaymentMode}`.toUpperCase() === 'INVOICE_PAY_LATER';
    const invoiceNumber = order?.invoiceNumber ?? order?.invoice?.number ?? hintedInvoiceNumber;
    const invoiceDueDate = order?.invoiceDueDate ?? order?.invoice?.dueDate ?? hintedInvoiceDueDate;
    const isPaid = isPaidStatus(status);
    const isFailed = isFailedStatus(status);
    const isPending = (isPendingStatus(status) || notFound || httpStatus === 202) && !isFailed && !isPaid;
    const statusLabel = mapOrderStatus(status).label;
    const title = isInvoiceFlow
        ? 'Order placed. Invoice issued.'
        : isPaid
        ? 'Order confirmed'
        : isFailed
            ? 'Payment failed'
            : 'Payment received / processing';
    const subtitle = isInvoiceFlow
        ? 'Your order was placed with invoice payment terms.'
        : isPaid
        ? 'Payment confirmed. A receipt has been sent to your email.'
        : isFailed
            ? 'Your payment did not complete. Please contact support if the issue persists, or return to your cart to try again.'
            : 'Thanks for your order! We are confirming your payment with Stripe and will update your order shortly.';

    useEffect(() => {
        if (!isPaid && !isInvoiceFlow) return;
        clearCart();
    }, [clearCart, isInvoiceFlow, isPaid]);

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <p className={styles.kicker}>{isInvoiceFlow ? 'Invoice order placed' : 'Payment received'}</p>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.subtitle}>{subtitle}</p>

                <div className={styles.statusCard}>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>{sessionId ? 'Checkout session' : 'Order'}</span>
                        <span className={styles.statusValue}>{sessionId || orderId || 'Pending'}</span>
                    </div>
                    {referenceId ? (
                        <div className={styles.statusRow}>
                            <span className={styles.statusLabel}>Reference ID</span>
                            <span className={styles.statusValue}>{referenceId}</span>
                        </div>
                    ) : null}
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Status</span>
                        <span className={styles.statusValue}>
                            {loading ? 'Loading…' : isPending ? 'Processing' : statusLabel}
                        </span>
                    </div>
                    {isInvoiceFlow && invoiceNumber ? (
                        <div className={styles.statusRow}>
                            <span className={styles.statusLabel}>Invoice number</span>
                            <span className={styles.statusValue}>{invoiceNumber}</span>
                        </div>
                    ) : null}
                    {isInvoiceFlow && invoiceDueDate ? (
                        <div className={styles.statusRow}>
                            <span className={styles.statusLabel}>Due date</span>
                            <span className={styles.statusValue}>{new Date(invoiceDueDate).toLocaleDateString()}</span>
                        </div>
                    ) : null}
                    {loading ? <p className={styles.statusMessage}>Fetching latest status…</p> : null}
                    {isPending && !loading ? (
                        <p className={styles.statusMessage}>
                            {notFound ? 'Processing…' : 'Awaiting confirmation…'}
                        </p>
                    ) : null}
                    {timedOut ? (
                        <p className={styles.statusMessage}>
                            Confirmation pending; you&apos;ll receive an email once confirmed.
                        </p>
                    ) : null}
                    {isPaid || isInvoiceFlow ? (
                        <p className={styles.statusMessage}>Your cart has been checked out.</p>
                    ) : null}
                    {error ? <p className={styles.errorMessage}>{error}</p> : null}
                    {pollingStopped && error ? (
                        <button type="button" className={styles.retryButton} onClick={handleRetry}>
                            {isRetrying ? 'Retrying…' : 'Retry'}
                        </button>
                    ) : null}
                </div>

                <div className={styles.actions}>
                    {isFailed ? (
                        <Link to="/store/cart" className={styles.primary}>Return to cart</Link>
                    ) : (
                        <Link to="/store" className={styles.primary}>Continue shopping</Link>
                    )}
                    <Link to="/store/cart" className={styles.secondary}>View cart</Link>
                </div>
            </div>
        </div>
    );
}
