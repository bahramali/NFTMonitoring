import React, { useEffect, useState } from 'react';
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

export default function OrderRow({
    order,
    detailsTo,
    receiptAvailable = false,
    compact = false,
    canCancel = false,
    cancelLoading = false,
    onCancel,
}) {
    const receiptTo = `${detailsTo}?document=receipt`;
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (!canCancel) {
            setConfirmOpen(false);
        }
    }, [canCancel]);

    const handleCancel = () => {
        if (!canCancel || !onCancel || cancelLoading) return;
        onCancel(order);
    };

    const cancelAction = canCancel ? (
        confirmOpen ? (
            <>
                <button type="button" className={styles.cancelConfirm} onClick={handleCancel} disabled={cancelLoading}>
                    {cancelLoading ? 'Cancelling…' : 'Confirm'}
                </button>
                <button
                    type="button"
                    className={styles.cancelDismiss}
                    onClick={() => setConfirmOpen(false)}
                    disabled={cancelLoading}
                >
                    Keep
                </button>
            </>
        ) : (
            <button type="button" className={styles.cancelAction} onClick={() => setConfirmOpen(true)}>
                Cancel
            </button>
        )
    ) : null;

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
                        {cancelAction}
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
                    {cancelAction}
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
                        {cancelAction}
                    </div>
                </div>
            </div>
        </>
    );
}
