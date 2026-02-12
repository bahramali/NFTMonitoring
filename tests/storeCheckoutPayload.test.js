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
            code: 'SPRING25',
        });
    });


    it('normalizes cart totals from cents fields', async () => {
        const { normalizeCartResponse } = await import('../src/api/store.js');

        const normalized = normalizeCartResponse({
            id: 'cart-1',
            currency: 'SEK',
            subtotalCents: 12900,
            discountCents: 1990,
            totalCents: 10910,
            items: [{ id: 'i1', quantity: 1, unitPriceCents: 12900, discountedUnitPriceCents: 10910, lineTotalCents: 12900, discountedLineTotalCents: 10910 }],
        });

        expect(normalized.totals).toMatchObject({
            currency: 'SEK',
            subtotal: 129,
            discount: 19.9,
            total: 109.1,
        });
        expect(normalized.items[0]).toMatchObject({
            unitPrice: 129,
            discountedUnitPrice: 109.1,
            lineTotal: 129,
            discountedLineTotal: 109.1,
        });
    });

    it('prefers discounted line values in normalized item shape when present', async () => {
        const { normalizeCartResponse } = await import('../src/api/store.js');

        const normalized = normalizeCartResponse({
            id: 'cart-2',
            totals: { currency: 'SEK', subtotalCents: 5000, discountCents: 500, totalCents: 4500 },
            items: [{ id: 'i2', quantity: 2, lineDiscountCents: 500 }],
        });

        expect(normalized.totals.discount).toBe(5);
        expect(normalized.items[0].lineDiscount).toBe(5);
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
