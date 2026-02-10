import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../src/utils/currency.js';

describe('formatCurrency', () => {
    it('always renders two decimals for SEK amounts', () => {
        expect(formatCurrency(29.9, 'SEK')).toBe('29,90\u00a0kr');
        expect(formatCurrency(29, 'SEK')).toBe('29,00\u00a0kr');
    });
});
