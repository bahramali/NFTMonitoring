import { mapOrderStatus } from '../src/utils/orderStatus.js';

describe('mapOrderStatus', () => {
    test('maps key statuses to expected metadata', () => {
        expect(mapOrderStatus('PENDING_PAYMENT')).toMatchObject({
            label: 'Awaiting payment',
            badgeVariant: 'warning',
            primaryActionType: 'continue-payment',
        });
        expect(mapOrderStatus('payment failed')).toMatchObject({
            label: 'Payment failed',
            badgeVariant: 'danger',
            primaryActionType: 'retry-payment',
        });
        expect(mapOrderStatus('PAID')).toMatchObject({
            label: 'Paid',
            badgeVariant: 'success',
            primaryActionType: 'view-order',
        });
        expect(mapOrderStatus('SHIPPED')).toMatchObject({
            label: 'Shipped',
            badgeVariant: 'info',
            primaryActionType: 'track-order',
        });
    });

    test('normalizes input and handles fallback', () => {
        expect(mapOrderStatus('delivered')).toMatchObject({
            label: 'Delivered',
            badgeVariant: 'success',
            primaryActionType: 'view-receipt',
        });
        expect(mapOrderStatus('payment-succeeded')).toMatchObject({
            label: 'Paid',
            badgeVariant: 'success',
            primaryActionType: 'view-order',
        });
        expect(mapOrderStatus(undefined)).toMatchObject({
            label: 'Status unknown',
            badgeVariant: 'neutral',
            primaryActionType: 'view-order',
        });
        expect(mapOrderStatus('unexpected status')).toMatchObject({
            label: 'Status unknown',
            badgeVariant: 'neutral',
            primaryActionType: 'view-order',
        });
    });
});
