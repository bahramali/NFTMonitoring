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
    it('uses public product list endpoint without auth for anonymous users', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ products: [] }));

        await listStoreProducts();

        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/store/products'), { signal: undefined });
        expect(fetchSpy.mock.calls[0][1]?.headers).toBeUndefined();
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
