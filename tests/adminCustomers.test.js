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
    it('accepts numeric customer ids', () => {
        expect(isNumericCustomerId('2')).toBe(true);
        expect(normalizeCustomerId('2')).toBe('2');
        expect(normalizeCustomerId('  42 ')).toBe('42');
    });

    it('rejects non-numeric or malformed ids', () => {
        expect(isNumericCustomerId('user_2')).toBe(false);
        expect(normalizeCustomerId('user_2')).toBe('');
        expect(normalizeCustomerId('user_abc')).toBe('');
        expect(normalizeCustomerId('abc')).toBe('');
        expect(normalizeCustomerId('')).toBe('');
    });
});

describe('adminCustomers API id validation', () => {
    const token = 'test-token';

    it('throws Invalid customer id for detail route calls', async () => {
        await expect(fetchAdminCustomer('abc', token)).rejects.toThrow('Invalid customer id');
    });

    it('throws Invalid customer id for coupon list calls', async () => {
        await expect(listAdminCustomerCoupons('user_abc', token)).rejects.toThrow('Invalid customer id');
    });

    it('throws Invalid customer id for coupon creation calls', async () => {
        await expect(createAdminCustomerCoupon('bad-id', { variantId: 'v1' }, token)).rejects.toThrow(
            'Invalid customer id',
        );
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
});
