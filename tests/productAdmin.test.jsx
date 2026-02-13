import { describe, expect, it } from 'vitest';

import { hasDuplicateVariantWeight, hasRealUuidId } from '../src/pages/ProductAdmin.jsx';

describe('ProductAdmin variant id detection', () => {
    it('treats only real UUIDs as existing variant ids', () => {
        expect(hasRealUuidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(hasRealUuidId(' 550e8400-e29b-41d4-a716-446655440000 ')).toBe(true);
        expect(hasRealUuidId('new-1')).toBe(false);
        expect(hasRealUuidId('')).toBe(false);
        expect(hasRealUuidId(null)).toBe(false);
    });
});

describe('ProductAdmin duplicate variant weights', () => {
    it('detects duplicate integer weights before save', () => {
        expect(hasDuplicateVariantWeight([
            { id: 'v1', weight: '50' },
            { id: 'v2', weight: '100' },
            { id: 'v3', weight: '50' },
        ])).toBe(true);
    });

    it('treats equivalent weight and weightGrams values as duplicates', () => {
        expect(hasDuplicateVariantWeight([
            { id: 'v1', weight: '75' },
            { id: 'v2', weightGrams: 75 },
        ])).toBe(true);
    });

    it('allows distinct weights', () => {
        expect(hasDuplicateVariantWeight([
            { id: 'v1', weight: '50' },
            { id: 'v2', weight: '51' },
        ])).toBe(false);
    });
});
