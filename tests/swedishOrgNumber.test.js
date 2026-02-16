import { describe, expect, it } from 'vitest';
import {
    isValidSwedishOrgNumberChecksum,
    normalizeSwedishOrgNumber,
    validateSwedishOrgNumber,
} from '../src/utils/swedishOrgNumber.js';

describe('swedishOrgNumber', () => {
    it('normalizes 12-digit input to 10 digits', () => {
        expect(normalizeSwedishOrgNumber('165566778899')).toBe('5566778899');
    });

    it('accepts valid format with dash and checksum', () => {
        const result = validateSwedishOrgNumber('556677-8899');
        expect(result.isValid).toBe(true);
        expect(result.normalized).toBe('5566778899');
    });

    it('rejects invalid characters', () => {
        const result = validateSwedishOrgNumber('556677-88A9');
        expect(result.isValid).toBe(false);
        expect(result.code).toBe('invalid_chars');
    });

    it('rejects invalid checksum', () => {
        expect(isValidSwedishOrgNumberChecksum('5566778898')).toBe(false);
        const result = validateSwedishOrgNumber('556677-8898');
        expect(result.isValid).toBe(false);
        expect(result.code).toBe('invalid_checksum');
    });
});
