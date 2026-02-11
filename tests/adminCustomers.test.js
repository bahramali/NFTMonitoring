import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    createAdminCustomerCoupon,
    fetchAdminCustomer,
    isNumericCustomerId,
    listAdminCustomerCoupons,
    listAdminCustomers,
    normalizeCustomerId,
} from '../src/api/adminCustomers.js';

const createJsonResponse = ({ ok = true, status = 200, body = { ok: true } } = {}) => ({
    ok,
    status,
    bodyUsed: false,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
        return this;
    },
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('adminCustomers customer id helpers', () => {
    it('accepts numeric and non-numeric customer ids from admin list', () => {
        expect(isNumericCustomerId('2')).toBe(true);
        expect(isNumericCustomerId('guest_abc')).toBe(false);
        expect(normalizeCustomerId('2')).toBe('2');
        expect(normalizeCustomerId('  guest_YWxpLmJhaHJhbWFsaUBzZ3MuY29t ')).toBe('guest_YWxpLmJhaHJhbWFsaUBzZ3MuY29t');
    });

    it('rejects only blank/missing ids', () => {
        expect(normalizeCustomerId('')).toBe('');
        expect(normalizeCustomerId('   ')).toBe('');
        expect(normalizeCustomerId(null)).toBe('');
    });
});

describe('adminCustomers API id validation', () => {
    const token = 'test-token';

    it('throws Invalid customer id for blank detail route ids', async () => {
        await expect(fetchAdminCustomer('   ', token)).rejects.toThrow('Invalid customer id');
    });

    it('throws Invalid customer id for blank coupon list ids', async () => {
        await expect(listAdminCustomerCoupons('', token)).rejects.toThrow('Invalid customer id');
    });

    it('throws Invalid customer id for blank coupon creation ids', async () => {
        await expect(createAdminCustomerCoupon('', { variantId: 'v1' }, token)).rejects.toThrow('Invalid customer id');
    });
});

describe('adminCustomers list normalization', () => {
    it('maps userId and lastLoginAt from backend payload variants', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                createJsonResponse({
                    body: {
                        customers: [
                            {
                                id: 3,
                                name: 'Ada',
                                user_id: 'auth0|abc123',
                                lastSignInAt: '2026-02-11T13:45:00Z',
                            },
                        ],
                    },
                }),
            ),
        );

        const response = await listAdminCustomers('token-123');

        expect(response.customers[0]).toMatchObject({
            id: '3',
            userId: 'auth0|abc123',
            lastLoginAt: '2026-02-11T13:45:00Z',
        });
    });

    it('falls back userId to id when backend sends only id', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                createJsonResponse({
                    body: {
                        items: [
                            {
                                id: 'guest_YWxpLmJhaHJhbWFsaUBzZ3MuY29t',
                                name: 'Ali Bahramali',
                                status: 'ACTIVE',
                            },
                        ],
                    },
                }),
            ),
        );

        const response = await listAdminCustomers('token-123');

        expect(response.customers[0]).toMatchObject({
            id: 'guest_YWxpLmJhaHJhbWFsaUBzZ3MuY29t',
            userId: 'guest_YWxpLmJhaHJhbWFsaUBzZ3MuY29t',
        });
    });

});
