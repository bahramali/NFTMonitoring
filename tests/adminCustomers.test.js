import { describe, expect, it } from 'vitest';

import {
    createAdminCustomerCoupon,
    fetchAdminCustomer,
    isNumericCustomerId,
    listAdminCustomerCoupons,
    normalizeCustomerId,
} from '../src/api/adminCustomers.js';

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
