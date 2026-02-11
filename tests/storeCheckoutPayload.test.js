import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetchMock = vi.fn();
const parseApiResponseMock = vi.fn();
const parseApiResponseWithMetaMock = vi.fn();

vi.mock('../src/api/http.js', () => ({
    authFetch: authFetchMock,
    parseApiResponse: parseApiResponseMock,
    parseApiResponseWithMeta: parseApiResponseWithMetaMock,
    buildAuthHeaders: vi.fn((token) => (token ? { Authorization: `Bearer ${token}` } : {})),
}));

vi.mock('../src/config/apiBase.js', () => ({
    getApiBaseUrl: () => 'https://example.test',
}));

describe('createStripeCheckoutSession payload', () => {
    beforeEach(() => {
        authFetchMock.mockReset();
        parseApiResponseMock.mockReset();
        parseApiResponseWithMetaMock.mockReset();
        global.fetch = vi.fn();
        authFetchMock.mockResolvedValue({ ok: true });
        parseApiResponseMock.mockResolvedValue({ checkoutUrl: 'https://stripe.test/session' });
        parseApiResponseWithMetaMock.mockResolvedValue({ data: { id: 'order-1' }, correlationId: 'corr-1' });
    });

    it('includes customerType and company data in request body', async () => {
        const { createStripeCheckoutSession } = await import('../src/api/store.js');

        await createStripeCheckoutSession('token-1', {
            cartId: 'cart-1',
            sessionId: 'sess-1',
            email: 'buyer@example.com',
            shippingAddress: { city: 'Stockholm' },
            customerType: 'B2B',
            company: {
                companyName: 'Acme AB',
                orgNumber: '556677-8899',
                invoiceEmail: 'invoice@example.com',
            },
        });

        expect(authFetchMock).toHaveBeenCalledTimes(1);
        const [, request] = authFetchMock.mock.calls[0];
        const body = JSON.parse(request.body);
        expect(body.customerType).toBe('B2B');
        expect(body.company).toEqual({
            companyName: 'Acme AB',
            orgNumber: '556677-8899',
            invoiceEmail: 'invoice@example.com',
        });
    });

    it('posts coupon apply requests to cart apply-coupon endpoint', async () => {
        const { applyStoreCoupon } = await import('../src/api/store.js');

        await applyStoreCoupon('token-1', {
            cartId: 'cart-1',
            sessionId: 'sess-1',
            couponCode: 'SPRING25',
        });

        expect(authFetchMock).toHaveBeenCalledTimes(1);
        const [url, request] = authFetchMock.mock.calls[0];
        expect(url).toBe('https://example.test/api/store/cart/apply-coupon');
        expect(request.method).toBe('POST');
        expect(request.headers).toMatchObject({
            Authorization: 'Bearer token-1',
            'X-Cart-Id': 'cart-1',
            'X-Session-Id': 'sess-1',
        });
        expect(JSON.parse(request.body)).toEqual({
            cartId: 'cart-1',
            couponCode: 'SPRING25',
        });
    });

    it('loads checkout success orders through store by-session route', async () => {
        const { fetchStoreOrderBySession } = await import('../src/api/store.js');
        global.fetch.mockResolvedValue({ ok: true, headers: { get: vi.fn() } });

        await fetchStoreOrderBySession('sess_123');

        expect(global.fetch).toHaveBeenCalledWith(
            'https://example.test/api/store/orders/by-session/sess_123',
            expect.objectContaining({ signal: undefined }),
        );
        expect(parseApiResponseWithMetaMock).toHaveBeenCalledTimes(1);
    });
});
