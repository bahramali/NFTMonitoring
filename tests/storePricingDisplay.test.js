import { describe, expect, it } from 'vitest';
import { displayLineTotal, displayPrice, hasBusinessProfile, normalizeVatRateDecimal, resolveTotalsBreakdown } from '../src/utils/storePricingDisplay.js';

describe('storePricingDisplay', () => {

    it('displays net prices in EXKL_MOMS mode and gross prices in INKL_MOMS mode', () => {
        expect(displayPrice(20, 0.12, 'EXKL_MOMS')).toBe(20);
        expect(displayPrice(20, 0.12, 'INKL_MOMS')).toBeCloseTo(22.4);
        expect(displayPrice(20, 12, 'INKL_MOMS')).toBeCloseTo(22.4);
    });

    it('calculates line totals from net unit prices', () => {
        expect(displayLineTotal(20, 3, 0.12, 'EXKL_MOMS')).toBe(60);
        expect(displayLineTotal(20, 3, 0.12, 'INKL_MOMS')).toBeCloseTo(67.2);
    });

    it('normalizes vat rate values from config payloads', () => {
        expect(normalizeVatRateDecimal(0.12)).toBeCloseTo(0.12);
        expect(normalizeVatRateDecimal(12)).toBeCloseTo(0.12);
    });
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
