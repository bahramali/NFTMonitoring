import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency.js';
import { mapOrderStatus, resolveOrderPrimaryAction } from '../../utils/orderStatus.js';
import styles from './OrderCard.module.css';

const statusVariantStyles = {
    success: styles.statusSuccess,
    warning: styles.statusWarning,
    info: styles.statusInfo,
    danger: styles.statusDanger,
    neutral: styles.statusNeutral,
};

const shortenOrderId = (orderId) => {
    const value = String(orderId || '').trim();
    if (!value) return '—';
    const cleaned = value.replace(/^#/, '');
    if (/^\d+$/.test(cleaned)) return cleaned;
    if (cleaned.length <= 8) return cleaned.toUpperCase();
    return cleaned.slice(0, 8).toUpperCase();
};

const resolveItemsCount = (order) => {
    if (typeof order?.itemsCount === 'number') return order.itemsCount;
    if (Array.isArray(order?.items)) return order.items.length;
    if (Array.isArray(order?.raw?.items)) return order.raw.items.length;
    if (Array.isArray(order?.raw?.lines)) return order.raw.lines.length;
    return null;
};

const resolvePaymentMethod = (order) =>
    order?.paymentMethod ||
    order?.raw?.paymentMethod ||
    order?.raw?.payment?.method ||
    order?.raw?.payment?.brand ||
    order?.raw?.payment?.type ||
    null;

const resolveDeliveryType = (order) =>
    order?.deliveryType ||
    order?.raw?.deliveryType ||
    order?.raw?.shippingMethod ||
    order?.raw?.delivery?.type ||
    null;

export default function OrderCard({
    order,
    primaryActionLabel,
    primaryActionTo,
    detailsTo,
    onPrimaryAction,
    primaryActionDisabled = false,
    primaryActionLoading = false,
    className = '',
}) {
    const orderId = order?.id || '';
    const labelId = shortenOrderId(orderId);
    const placedAt = order?.createdAt ? new Date(order.createdAt).toLocaleString() : '—';
    const status = order?.status || 'Unknown';
    const statusMeta = mapOrderStatus(status);
    const badgeClassName = statusVariantStyles[statusMeta.badgeVariant] ?? styles.statusNeutral;
    const primaryAction = resolveOrderPrimaryAction(status, { hasTracking: Boolean(order?.trackingUrl) });
    const total = order?.total != null ? formatCurrency(order.total, order.currency) : '—';
    const itemCount = resolveItemsCount(order);
    const paymentMethod = resolvePaymentMethod(order);
    const deliveryType = resolveDeliveryType(order);
    const detailsHref = detailsTo || primaryActionTo || '#';
    const primaryHref = primaryActionTo || detailsHref;
    const actionLabel = primaryActionLabel ?? primaryAction.label;
    const shouldHandlePaymentAction =
        ['continue-payment', 'retry-payment'].includes(primaryAction.type) && typeof onPrimaryAction === 'function';

    return (
        <article className={`${styles.card} ${className}`}>
            <header className={styles.header}>
                <div>
                    <p className={styles.orderLabel}>Order #{labelId}</p>
                    <p className={styles.placedAt}>Placed {placedAt}</p>
                </div>
                <span className={`${styles.statusBadge} ${badgeClassName}`}>{statusMeta.label}</span>
            </header>

            <section className={styles.summary}>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total</span>
                    <span className={styles.summaryValue}>{total}</span>
                </div>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Items</span>
                    <span className={styles.summaryValue}>
                        {itemCount != null ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : '—'}
                    </span>
                </div>
                {paymentMethod ? (
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Payment</span>
                        <span className={styles.summaryValue}>{paymentMethod}</span>
                    </div>
                ) : null}
                {deliveryType ? (
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Delivery</span>
                        <span className={styles.summaryValue}>{deliveryType}</span>
                    </div>
                ) : null}
            </section>

            <footer className={styles.actions}>
                {shouldHandlePaymentAction ? (
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => onPrimaryAction(order, primaryAction)}
                        disabled={primaryActionDisabled || primaryActionLoading}
                    >
                        {primaryActionLoading ? 'Opening payment…' : actionLabel}
                    </button>
                ) : (
                    <Link to={primaryHref} className={styles.primaryButton}>
                        {actionLabel}
                    </Link>
                )}
                <Link to={detailsHref} className={styles.secondaryLink}>
                    View details
                </Link>
            </footer>
        </article>
    );
}
