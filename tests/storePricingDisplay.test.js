import { describe, expect, it } from 'vitest';
import { hasBusinessProfile, resolveTotalsBreakdown } from '../src/utils/storePricingDisplay.js';

describe('storePricingDisplay', () => {
    it('detects B2B profile based on tier and customer type flags', () => {
        expect(hasBusinessProfile({ pricingTier: 'B2B' })).toBe(true);
        expect(hasBusinessProfile({ customerType: 'company' })).toBe(true);
        expect(hasBusinessProfile({ raw: { accountType: 'restaurant' } })).toBe(true);
        expect(hasBusinessProfile({ pricingTier: 'DEFAULT' })).toBe(false);
    });

    it('prefers backend-provided net and vat totals', () => {
        const totals = resolveTotalsBreakdown({
            total: 125,
            tax: 25,
            totalExVat: 100,
        });

        expect(totals).toEqual({
            net: 100,
            vat: 25,
            gross: 125,
        });
    });

    it('falls back to gross-vat breakdown when net is not present', () => {
        const totals = resolveTotalsBreakdown({ total: 250, moms: 50 });
        expect(totals).toEqual({
            net: 200,
            vat: 50,
            gross: 250,
        });
    });
});
