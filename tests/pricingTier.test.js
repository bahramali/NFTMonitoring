import { describe, it, expect } from 'vitest';
import { resolvePricingForTier, resolveTierPrice } from '../src/utils/pricingTier.js';

describe('resolveTierPrice', () => {
    it('prefers tierPricesSek values when present', () => {
        const entity = {
            tierPricesSek: {
                VIP: 10,
            },
            tierPrices: {
                VIP: 1000,
            },
        };

        expect(resolveTierPrice(entity, 'VIP')).toBe(10);
    });

    it('treats tierPrices values as cents', () => {
        const entity = {
            tierPrices: {
                VIP: 2990,
                supporter: '13990',
            },
        };

        expect(resolveTierPrice(entity, 'VIP')).toBe(29.9);
        expect(resolveTierPrice(entity, 'SUPPORTER')).toBe(139.9);
    });

    it('keeps fallback price logic when no tier map is available', () => {
        expect(resolveTierPrice({ priceSek: 49.5 }, 'VIP')).toBe(49.5);
        expect(resolveTierPrice({ price: 39.5 }, 'VIP')).toBe(39.5);
        expect(resolveTierPrice({ unitPrice: 29.5 }, 'VIP')).toBe(29.5);
    });
});

describe('resolvePricingForTier', () => {
    it('returns regular and tier prices with applied tier metadata', () => {
        const entity = {
            tierPricesSek: {
                DEFAULT: 29.9,
                VIP: 10,
            },
        };

        expect(resolvePricingForTier(entity, 'VIP')).toEqual({
            regularPriceSek: 29.9,
            customerPriceSek: 10,
            appliedTier: 'VIP',
        });
    });
});
