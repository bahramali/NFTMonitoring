import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetchMock = vi.fn();
const parseApiResponseMock = vi.fn();

vi.mock('../src/api/http.js', () => ({
    authFetch: authFetchMock,
    parseApiResponse: parseApiResponseMock,
    parseApiResponseWithMeta: vi.fn(),
    buildAuthHeaders: vi.fn((token) => (token ? { Authorization: `Bearer ${token}` } : {})),
}));

vi.mock('../src/config/apiBase.js', () => ({
    getApiBaseUrl: () => 'https://example.test',
}));

describe('createStripeCheckoutSession payload', () => {
    beforeEach(() => {
        authFetchMock.mockReset();
        parseApiResponseMock.mockReset();
        authFetchMock.mockResolvedValue({ ok: true });
        parseApiResponseMock.mockResolvedValue({ checkoutUrl: 'https://stripe.test/session' });
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
});
