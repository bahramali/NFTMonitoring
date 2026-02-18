import { mapOrderStatus } from '../src/utils/orderStatus.js';

describe('mapOrderStatus', () => {
    test('maps key statuses to expected metadata', () => {
        expect(mapOrderStatus('PENDING_PAYMENT')).toMatchObject({
            label: 'Pending confirmation',
            badgeVariant: 'warning',
            primaryActionType: 'continue-payment',
        });
        expect(mapOrderStatus('payment failed')).toMatchObject({
            label: 'Failed',
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
        expect(mapOrderStatus('RECEIVED')).toMatchObject({
            label: 'Received',
            badgeVariant: 'info',
            primaryActionType: 'view-order',
        });
    });

    test('normalizes input and handles fallback', () => {
        expect(mapOrderStatus('delivered')).toMatchObject({
            label: 'Completed',
            badgeVariant: 'success',
            primaryActionType: 'view-receipt',
        });
        expect(mapOrderStatus('payment-succeeded')).toMatchObject({
            label: 'Paid',
            badgeVariant: 'success',
            primaryActionType: 'view-order',
        });
        expect(mapOrderStatus(undefined)).toMatchObject({
            label: 'Pending confirmation',
            badgeVariant: 'warning',
            primaryActionType: 'view-order',
        });
        expect(mapOrderStatus('unexpected status')).toMatchObject({
            label: 'Pending confirmation',
            badgeVariant: 'warning',
            primaryActionType: 'view-order',
        });
        expect(mapOrderStatus('RECEIVED').label).not.toBe('Pending confirmation');
    });
});
