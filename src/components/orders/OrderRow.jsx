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
    const receiptTo = `${detailsTo}?document=receipt`;

    if (compact) {
        return (
            <div className={styles.compactRow}>
                <div className={styles.mobileTop}>
                    <div>
                        <Link to={detailsTo} className={styles.orderLink}>#{order?.id}</Link>
                        <p className={styles.meta}>{formatDate(order?.createdAt)}</p>
                    </div>
                    <OrderStatusPill status={order?.status} />
                </div>
                <div className={styles.mobileBottom}>
                    <strong>{formatCurrency(order?.total, order?.currency)}</strong>
                    <div className={styles.actions}>
                        <Link to={detailsTo} className={styles.viewButton}>View details</Link>
                        {receiptAvailable ? <Link to={receiptTo} className={styles.receiptAction}>View receipt</Link> : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={styles.row}>
                <div>
                    <Link to={detailsTo} className={styles.orderLink}>#{order?.id}</Link>
                    <p className={styles.meta}>{formatDate(order?.createdAt)}</p>
                </div>
                <strong>{formatCurrency(order?.total, order?.currency)}</strong>
                <OrderStatusPill status={order?.status} />
                <div className={styles.actions}>
                    <Link to={detailsTo} className={styles.viewButton}>View details</Link>
                    {receiptAvailable ? <Link to={receiptTo} className={styles.receiptAction}>View receipt</Link> : <span className={styles.dim}>View receipt</span>}
                </div>
            </div>
            <div className={styles.mobileRow}>
                <div className={styles.mobileTop}>
                    <div>
                        <Link to={detailsTo} className={styles.orderLink}>#{order?.id}</Link>
                        <p className={styles.meta}>{formatDate(order?.createdAt)}</p>
                    </div>
                    <OrderStatusPill status={order?.status} />
                </div>
                <div className={styles.mobileBottom}>
                    <strong>{formatCurrency(order?.total, order?.currency)}</strong>
                    <div className={styles.actions}>
                        <Link to={detailsTo} className={styles.viewButton}>View details</Link>
                        {receiptAvailable ? <Link to={receiptTo} className={styles.receiptAction}>View receipt</Link> : null}
                    </div>
                </div>
            </div>
        </>
    );
}
