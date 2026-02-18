import { describe, expect, it } from 'vitest';

import { canCancelOrder, normalizeOrder } from './orderUtils.js';

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
