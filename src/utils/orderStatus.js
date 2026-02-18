const STATUS_VARIANTS = {
    PENDING_PAYMENT: {
        label: 'Pending confirmation',
        description: 'We’re confirming your payment. This can take up to a minute. We’ll email you when it’s confirmed.',
        badgeVariant: 'warning',
        primaryActionType: 'continue-payment',
    },
    PENDING_CONFIRMATION: {
        label: 'Pending confirmation',
        description: 'We’re confirming your payment. This can take up to a minute. We’ll email you when it’s confirmed.',
        badgeVariant: 'warning',
        primaryActionType: 'view-order',
    },
    PENDING: {
        label: 'Pending confirmation',
        description: 'We’re confirming your payment. This can take up to a minute. We’ll email you when it’s confirmed.',
        badgeVariant: 'warning',
        primaryActionType: 'view-order',
    },
    RECEIVED: {
        label: 'Received',
        description: 'We’ve received your order. You can still cancel it until we start preparing it.',
        badgeVariant: 'info',
        primaryActionType: 'view-order',
    },
    PAYMENT_FAILED: {
        label: 'Failed',
        description: 'Payment did not complete. Please retry to place the order.',
        badgeVariant: 'danger',
        primaryActionType: 'retry-payment',
    },
    FAILED: {
        label: 'Failed',
        description: 'Payment did not complete. Please retry to place the order.',
        badgeVariant: 'danger',
        primaryActionType: 'retry-payment',
    },
    PAID: {
        label: 'Paid',
        description: 'Payment confirmed. A receipt has been sent to your email.',
        badgeVariant: 'success',
        primaryActionType: 'view-order',
    },
    PAYMENT_SUCCEEDED: {
        label: 'Paid',
        description: 'Payment confirmed. A receipt has been sent to your email.',
        badgeVariant: 'success',
        primaryActionType: 'view-order',
    },
    REFUNDED: {
        label: 'Refunded',
        description: 'Payment was refunded.',
        badgeVariant: 'neutral',
        primaryActionType: 'view-order',
    },
    PROCESSING: {
        label: 'Preparing',
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
    READY_FOR_PICKUP: {
        label: 'Ready for pickup',
        description: 'Your order is ready for pickup.',
        badgeVariant: 'info',
        primaryActionType: 'view-order',
    },
    DELIVERED: {
        label: 'Completed',
        description: 'Your order has been delivered.',
        badgeVariant: 'success',
        primaryActionType: 'view-receipt',
    },
    COMPLETED: {
        label: 'Completed',
        description: 'Your order is complete.',
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
    CANCELLED_BY_CUSTOMER: {
        label: 'Cancelled',
        description: 'This order was cancelled by the customer and is now read-only.',
        badgeVariant: 'neutral',
        primaryActionType: 'view-order',
    },
};

const FALLBACK_STATUS = {
    label: 'Pending confirmation',
    description: 'We’re confirming your payment. This can take up to a minute. We’ll email you when it’s confirmed.',
    badgeVariant: 'warning',
    primaryActionType: 'view-order',
};

const ACTION_LABELS = {
    'continue-payment': 'Continue payment',
    'retry-payment': 'Try payment again',
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
