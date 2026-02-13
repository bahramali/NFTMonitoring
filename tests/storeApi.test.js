import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStoreProduct, listStoreProducts } from '../src/api/store.js';

const jsonResponse = (payload) => ({
    ok: true,
    status: 200,
    bodyUsed: false,
    headers: {
        get: () => 'application/json',
    },
    clone() {
        return this;
    },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('store product API auth behavior', () => {
    it('routes anonymous product list through authFetch without bearer token', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ products: [] }));

        await listStoreProducts();

        expect(fetchSpy.mock.calls[0][0]).toEqual(expect.stringContaining('/api/store/products'));
        expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: undefined, headers: {} });
    });

    it('sends bearer auth for product list when token exists', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ products: [] }));

        await listStoreProducts({ token: 'token-123' });

        expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({
            Authorization: 'Bearer token-123',
            'Content-Type': 'application/json',
        });
    });

    it('sends bearer auth for product detail when token exists', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ product: { id: 'p-1' } }));

        await fetchStoreProduct('p-1', { token: 'token-abc' });

        expect(fetchSpy.mock.calls[0][0]).toMatch(/\/api\/store\/products\/p-1$/);
        expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({
            Authorization: 'Bearer token-abc',
            'Content-Type': 'application/json',
        });
    });
});
