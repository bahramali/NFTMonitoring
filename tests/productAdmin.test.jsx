import { describe, expect, it } from 'vitest';

import { hasRealUuidId } from '../src/pages/ProductAdmin.jsx';

describe('ProductAdmin variant id detection', () => {
    it('treats only real UUIDs as existing variant ids', () => {
        expect(hasRealUuidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(hasRealUuidId(' 550e8400-e29b-41d4-a716-446655440000 ')).toBe(true);
        expect(hasRealUuidId('new-1')).toBe(false);
        expect(hasRealUuidId('')).toBe(false);
        expect(hasRealUuidId(null)).toBe(false);
    });
});
