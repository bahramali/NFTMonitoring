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
