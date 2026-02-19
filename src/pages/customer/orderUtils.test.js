import { describe, expect, it } from 'vitest';

import { canCancelOrder, getOrderDisplayNumber, normalizeOrder, normalizeOrderList } from './orderUtils.js';

describe('normalizeOrder invoice mode details', () => {
    it('normalizes pay-later invoice details and defaults status to UNPAID', () => {
        const order = normalizeOrder({
            id: 'o-1',
            paymentMode: 'INVOICE_PAY_LATER',
            invoice: {
                number: 'INV-101',
                dueDate: '2026-02-20T00:00:00.000Z',
                bankgiro: '5555-1234',
                ocr: '1234567890',
            },
        });

        expect(order.paymentMode).toBe('INVOICE_PAY_LATER');
        expect(order.paymentMethod).toBe('Invoice');
        expect(order.paymentStatus).toBe('UNPAID');
        expect(order.bankgiro).toBe('5555-1234');
        expect(order.invoiceOcr).toBe('1234567890');
        expect(order.invoiceDueDate).toBe('2026-02-20T00:00:00.000Z');
    });
});


describe('canCancelOrder', () => {
    it('allows cancellation for RECEIVED status', () => {
        expect(canCancelOrder('RECEIVED')).toBe(true);
    });
});


describe('status normalization precedence', () => {
    it('prefers orderStatus over displayStatus in order lists', () => {
        const [order] = normalizeOrderList([{
            id: '1',
            displayStatus: 'Pending UI Label',
            orderStatus: 'PROCESSING',
        }]);

        expect(order.status).toBe('PROCESSING');
    });

    it('accepts snake_case status fields in normalizeOrder', () => {
        const order = normalizeOrder({
            order: {
                id: '2',
                order_status: 'CANCELLED_BY_CUSTOMER',
            },
        });

        expect(order.orderStatus).toBe('CANCELLED_BY_CUSTOMER');
        expect(order.status).toBe('CANCELLED_BY_CUSTOMER');
    });
});


describe('getOrderDisplayNumber', () => {
    it('uses formatted order number when available', () => {
        expect(getOrderDisplayNumber({ formattedOrderNumber: 'HL-1771338326964', orderNumber: 123, id: 'uuid' })).toBe('HL-1771338326964');
    });

    it('falls back to HL-prefixed order number', () => {
        expect(getOrderDisplayNumber({ orderNumber: 1771338326964, id: 'uuid' })).toBe('HL-1771338326964');
    });

    it('falls back to UUID when no formatted or numeric order number exists', () => {
        expect(getOrderDisplayNumber({ id: '14d96268-5021-4621-a9ed-b719817fc9a2' })).toBe('#14d96268-5021-4621-a9ed-b719817fc9a2');
    });
});
