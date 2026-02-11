import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchStoreOrderBySession } from '../../api/store.js';
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
const MAX_POLL_DURATION_MS = 180000;

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
    const { clearCart } = useStorefront();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [timedOut, setTimedOut] = useState(false);
    const [referenceId, setReferenceId] = useState(null);
    const startTimeRef = useRef(null);
    const timeoutRef = useRef(null);
    const orderRef = useRef(null);

    useEffect(() => {
        if (!sessionId) return;
        console.info('Checkout success session observed.', { sessionId });
    }, [sessionId]);

    useEffect(() => {
        if (!referenceId) return;
        console.info('Checkout status request correlation id received.', { correlationId: referenceId });
    }, [referenceId]);

    useEffect(() => {
        if (!sessionId) return;
        let isMounted = true;
        const controller = new AbortController();
        const startedAt = Date.now();
        startTimeRef.current = startedAt;
        setTimedOut(false);
        setError(null);
        setNotFound(false);
        setOrder(null);
        orderRef.current = null;

        const poll = async () => {
            if (!isMounted) return;
            setLoading(true);
            let latestOrder = null;
            try {
                const { data, correlationId } = await fetchStoreOrderBySession(sessionId, { signal: controller.signal });
                if (!isMounted) return;
                latestOrder = normalizeOrderPayload(data);
                setOrder(latestOrder);
                orderRef.current = latestOrder;
                setError(null);
                setNotFound(false);
                if (correlationId) {
                    setReferenceId((prev) => (prev === correlationId ? prev : correlationId));
                }
            } catch (err) {
                if (!isMounted || err?.name === 'AbortError') return;
                if (err?.status === 404) {
                    setNotFound(true);
                } else {
                    setError(err?.message || 'Unable to load order status.');
                }
                if (err?.correlationId) {
                    setReferenceId((prev) => (prev === err.correlationId ? prev : err.correlationId));
                }
            } finally {
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
                timeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
            } else if (!isMounted) {
                return;
            } else if (elapsed >= MAX_POLL_DURATION_MS) {
                setTimedOut(true);
            }
        };

        poll();

        return () => {
            isMounted = false;
            controller.abort();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [sessionId]);

    const status = useMemo(() => resolveOrderStatus(order), [order]);
    const isPaid = isPaidStatus(status);
    const isFailed = isFailedStatus(status);
    const isPending = isPendingStatus(status) || notFound;
    const statusLabel = mapOrderStatus(status).label;
    const title = isPaid
        ? 'Order confirmed'
        : isFailed
            ? 'Payment failed'
            : 'Payment received / processing';
    const subtitle = isPaid
        ? 'Payment confirmed. A receipt has been sent to your email.'
        : isFailed
            ? 'Your payment did not complete. Please contact support if the issue persists, or return to your cart to try again.'
            : 'Thanks for your order! We are confirming your payment with Stripe and will update your order shortly.';

    useEffect(() => {
        if (!isPaid) return;
        clearCart();
    }, [clearCart, isPaid]);

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <p className={styles.kicker}>Payment received</p>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.subtitle}>{subtitle}</p>

                <div className={styles.statusCard}>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>Checkout session</span>
                        <span className={styles.statusValue}>{sessionId || 'Pending'}</span>
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
                    {error ? <p className={styles.errorMessage}>{error}</p> : null}
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
