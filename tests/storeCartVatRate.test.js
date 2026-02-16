import { describe, expect, it } from 'vitest';
import { normalizeCartResponse } from '../src/api/store.js';

describe('normalizeCartResponse VAT fallback', () => {
    it('estimates VAT from item vatRate when totals.tax is missing', () => {
        const cart = normalizeCartResponse({
            id: 'cart-1',
            items: [
                {
                    id: 'line-1',
                    quantity: 2,
                    discountedUnitPrice: 56,
                    vatRate: 12,
                },
            ],
            totals: {
                subtotal: 112,
                shipping: 0,
                discount: 0,
                total: 112,
                currency: 'SEK',
            },
        });

        expect(cart.totals.tax).toBeCloseTo(12, 3);
    });

    it('keeps backend tax when provided', () => {
        const cart = normalizeCartResponse({
            id: 'cart-1',
            items: [
                {
                    id: 'line-1',
                    quantity: 1,
                    discountedUnitPrice: 112,
                    vatRate: 12,
                },
            ],
            totals: {
                subtotal: 112,
                tax: 25,
                total: 137,
                currency: 'SEK',
            },
        });

        expect(cart.totals.tax).toBe(25);
    });
});
