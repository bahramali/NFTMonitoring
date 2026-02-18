import { describe, expect, it } from 'vitest';
import { canCancelOrder, normalizeOrder } from '../src/pages/customer/orderUtils.js';

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

    it('defaults method/reference for invoice mode when missing', () => {
        const order = normalizeOrder({
            id: 'ord-3',
            paymentMode: 'invoice-pay-later',
            invoiceNumber: 'INV-42',
        });

        expect(order.paymentMode).toBe('INVOICE_PAY_LATER');
        expect(order.paymentMethod).toBe('Invoice');
        expect(order.paymentReference).toBe('INV-42');
    });
});

describe('normalizeOrder totals', () => {
    it('reads VAT from moms totals fields', () => {
        const order = normalizeOrder({
            id: 'ord-moms',
            totals: {
                total: 125,
                moms: 25,
            },
        });

        expect(order.totals.tax).toBe(25);
    });

    it('reads VAT from vat cents totals fields', () => {
        const order = normalizeOrder({
            id: 'ord-vat',
            totals: {
                totalCents: 12500,
                vatCents: 2500,
            },
        });

        expect(order.totals.tax).toBe(25);
    });
});

describe('canCancelOrder', () => {
    it('returns true for pending orders', () => {
        expect(canCancelOrder('pending payment')).toBe(true);
        expect(canCancelOrder('PROCESSING')).toBe(true);
    });

    it('returns false for final states', () => {
        expect(canCancelOrder('completed')).toBe(false);
        expect(canCancelOrder('CANCELLED_BY_CUSTOMER')).toBe(false);
    });
});
