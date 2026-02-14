import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetchMock = vi.fn();
const parseApiResponseMock = vi.fn();
const buildAuthHeadersMock = vi.fn((token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }));

vi.mock('./http.js', () => ({
    authFetch: authFetchMock,
    parseApiResponse: parseApiResponseMock,
    parseApiResponseWithMeta: vi.fn(),
    buildAuthHeaders: buildAuthHeadersMock,
}));

vi.mock('../config/apiBase.js', () => ({
    getApiBaseUrl: () => 'http://localhost:8080',
}));

describe('listStoreProducts', () => {
    beforeEach(() => {
        authFetchMock.mockReset();
        parseApiResponseMock.mockReset();
        buildAuthHeadersMock.mockClear();
        window.sessionStorage.clear();
    });

    it('uses authFetch without explicit token so auth layer can inject from session', async () => {
        const apiPayload = { products: [{ id: 'p1' }] };
        const fakeResponse = { ok: true };
        authFetchMock.mockResolvedValue(fakeResponse);
        parseApiResponseMock.mockResolvedValue(apiPayload);

        const { listStoreProducts } = await import('./store.js');
        const result = await listStoreProducts();

        expect(authFetchMock).toHaveBeenCalledWith(
            'http://localhost:8080/api/store/products',
            {
                signal: undefined,
                headers: undefined,
            },
            { token: null },
        );
        expect(parseApiResponseMock).toHaveBeenCalledWith(fakeResponse, 'Failed to load products');
        expect(result).toEqual(apiPayload);
    });

    it('uses authFetch with explicit bearer header when token is passed', async () => {
        authFetchMock.mockResolvedValue({ ok: true });
        parseApiResponseMock.mockResolvedValue({ products: [] });

        const { listStoreProducts } = await import('./store.js');
        await listStoreProducts({ token: 'test-token' });

        expect(buildAuthHeadersMock).toHaveBeenCalledWith('test-token');
        expect(authFetchMock).toHaveBeenCalledWith(
            'http://localhost:8080/api/store/products',
            {
                signal: undefined,
                headers: {
                    Authorization: 'Bearer test-token',
                    'Content-Type': 'application/json',
                },
            },
            { token: 'test-token' },
        );
    });

});

describe('cart API auth behavior', () => {
    beforeEach(() => {
        authFetchMock.mockReset();
        parseApiResponseMock.mockReset();
    });

    it('fetches current cart with authFetch so JWT can be attached', async () => {
        const fakeResponse = { ok: true };
        const apiPayload = { id: 'cart-1', items: [] };
        authFetchMock.mockResolvedValue(fakeResponse);
        parseApiResponseMock.mockResolvedValue(apiPayload);

        const { fetchCurrentStoreCart } = await import('./store.js');
        const result = await fetchCurrentStoreCart();

        expect(authFetchMock).toHaveBeenCalledWith(
            'http://localhost:8080/api/store/cart',
            {
                method: 'GET',
                credentials: 'include',
                signal: undefined,
            },
        );
        expect(parseApiResponseMock).toHaveBeenCalledWith(fakeResponse, 'Failed to fetch current cart');
        expect(result).toEqual(apiPayload);
    });

    it('adds cart item via authFetch with cart headers', async () => {
        const fakeResponse = { ok: true };
        authFetchMock.mockResolvedValue(fakeResponse);
        parseApiResponseMock.mockResolvedValue({ id: 'cart-1' });

        const { addItemToCart } = await import('./store.js');
        await addItemToCart('cart-1', 'session-1', 'variant-7', 3);

        expect(authFetchMock).toHaveBeenCalledWith(
            'http://localhost:8080/api/store/cart/cart-1/items',
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cart-Id': 'cart-1',
                    'X-Session-Id': 'session-1',
                },
                body: JSON.stringify({ variantId: 'variant-7', quantity: 3 }),
                signal: undefined,
            },
        );
    });
});
