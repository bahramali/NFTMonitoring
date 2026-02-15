import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency.js';
import OrderStatusPill from './OrderStatusPill.jsx';
import styles from './OrderRow.module.css';

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
};

export default function OrderRow({ order, detailsTo, receiptAvailable = false, compact = false }) {
    const paymentMethod = order?.paymentMethod || order?.raw?.payment?.method || order?.raw?.payment_type || '—';
    const deliveryMethod = order?.deliveryType || order?.raw?.deliveryType || order?.raw?.shippingMethod || '—';

    if (compact) {
        return (
            <div className={styles.compactRow}>
                <div className={styles.mobileTop}>
                    <Link to={detailsTo} className={styles.orderLink}>#{order?.id}</Link>
                    <OrderStatusPill status={order?.status} />
                </div>
                <div className={styles.mobileBottom}>
                    <span>{formatCurrency(order?.total, order?.currency)}</span>
                    <span>{formatDate(order?.createdAt)}</span>
                    <Link to={detailsTo} className={styles.viewButton}>View</Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={styles.row}>
                <Link to={detailsTo} className={styles.orderLink}>#{order?.id}</Link>
                <span>{formatDate(order?.createdAt)}</span>
                <OrderStatusPill status={order?.status} />
                <span>{paymentMethod}</span>
                <span>{deliveryMethod}</span>
                <strong>{formatCurrency(order?.total, order?.currency)}</strong>
                <div className={styles.actions}>
                    <Link to={detailsTo} className={styles.viewButton}>View details</Link>
                    {receiptAvailable ? <span className={styles.receiptLabel}>Receipt</span> : <span className={styles.dim}>Receipt</span>}
                </div>
            </div>
            <div className={styles.mobileRow}>
                <div className={styles.mobileTop}>
                    <Link to={detailsTo} className={styles.orderLink}>#{order?.id}</Link>
                    <OrderStatusPill status={order?.status} />
                </div>
                <div className={styles.mobileBottom}>
                    <span>{formatCurrency(order?.total, order?.currency)}</span>
                    <span>{formatDate(order?.createdAt)}</span>
                    <Link to={detailsTo} className={styles.viewButton}>View details</Link>
                </div>
            </div>
        </>
    );
}
