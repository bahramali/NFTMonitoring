import { describe, expect, it } from 'vitest';
import { normalizeOrder } from '../src/pages/customer/orderUtils.js';

describe('normalizeOrder payment fields', () => {
    it('reads payment method/reference from flat fields', () => {
        const order = normalizeOrder({
            id: 'ord-1',
            paymentStatus: 'PAID',
            paymentMethod: 'Card',
            paymentReference: 'pi_123',
        });

        expect(order.paymentStatus).toBe('PAID');
        expect(order.paymentMethod).toBe('Card');
        expect(order.paymentReference).toBe('pi_123');
    });

    it('reads payment method/reference from nested payment fields', () => {
        const order = normalizeOrder({
            id: 'ord-2',
            payment: {
                status: 'PAID',
                method: 'Swish',
                reference: 'txn_789',
            },
        });

        expect(order.paymentStatus).toBe('PAID');
        expect(order.paymentMethod).toBe('Swish');
        expect(order.paymentReference).toBe('txn_789');
    });
});
