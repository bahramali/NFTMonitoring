const STATUS_VARIANTS = {
    PENDING_PAYMENT: {
        label: 'Awaiting payment',
        description: 'Payment is required to complete this order.',
        badgeVariant: 'warning',
        primaryActionType: 'continue-payment',
    },
    PAYMENT_FAILED: {
        label: 'Payment failed',
        description: 'Payment did not complete. Please retry to place the order.',
        badgeVariant: 'danger',
        primaryActionType: 'retry-payment',
    },
    FAILED: {
        label: 'Payment failed',
        description: 'Payment did not complete. Please retry to place the order.',
        badgeVariant: 'danger',
        primaryActionType: 'retry-payment',
    },
    PAID: {
        label: 'Paid',
        description: 'Payment received. Your order is confirmed.',
        badgeVariant: 'success',
        primaryActionType: 'view-order',
    },
    PAYMENT_SUCCEEDED: {
        label: 'Paid',
        description: 'Payment received. Your order is confirmed.',
        badgeVariant: 'success',
        primaryActionType: 'view-order',
    },
    PROCESSING: {
        label: 'Processing',
        description: 'Your order is being prepared.',
        badgeVariant: 'info',
        primaryActionType: 'view-order',
    },
    SHIPPED: {
        label: 'Shipped',
        description: 'Your order is on the way.',
        badgeVariant: 'info',
        primaryActionType: 'track-order',
    },
    DELIVERED: {
        label: 'Delivered',
        description: 'Your order has been delivered.',
        badgeVariant: 'success',
        primaryActionType: 'view-receipt',
    },
    CANCELLED: {
        label: 'Cancelled',
        description: 'This order was cancelled.',
        badgeVariant: 'neutral',
        primaryActionType: 'view-order',
    },
    CANCELED: {
        label: 'Cancelled',
        description: 'This order was cancelled.',
        badgeVariant: 'neutral',
        primaryActionType: 'view-order',
    },
};

const FALLBACK_STATUS = {
    label: 'Status unknown',
    description: 'Status details are not available yet.',
    badgeVariant: 'neutral',
    primaryActionType: 'view-order',
};

const ACTION_LABELS = {
    'continue-payment': 'Continue payment',
    'retry-payment': 'Retry payment',
    'view-order': 'View order',
    'track-order': 'Track order',
    'view-receipt': 'View receipt',
};

export const mapOrderStatus = (status) => {
    const normalized = String(status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return STATUS_VARIANTS[normalized] ?? FALLBACK_STATUS;
};

export const resolveOrderPrimaryAction = (status, { hasTracking = true } = {}) => {
    const statusMeta = mapOrderStatus(status);
    let actionType = statusMeta.primaryActionType;
    if (actionType === 'track-order' && !hasTracking) {
        actionType = 'view-order';
    }
    return {
        type: actionType,
        label: ACTION_LABELS[actionType] ?? ACTION_LABELS['view-order'],
    };
};

export const resolveOrderStatusLabel = (status) => mapOrderStatus(status).label;
