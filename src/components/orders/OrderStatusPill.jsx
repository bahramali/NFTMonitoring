import React from 'react';
import { mapOrderStatus } from '../../utils/orderStatus.js';
import styles from './OrderStatusPill.module.css';

const variantClass = {
    success: styles.success,
    warning: styles.warning,
    info: styles.info,
    danger: styles.danger,
    neutral: styles.neutral,
};

export default function OrderStatusPill({ status }) {
    const meta = mapOrderStatus(status);
    const className = variantClass[meta.badgeVariant] || styles.neutral;
    return <span className={`${styles.pill} ${className}`}>{meta.label}</span>;
}
