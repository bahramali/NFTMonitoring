import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import AdminOrders from '../src/pages/store/AdminOrders.jsx';
import { renderWithAuthSession } from './utils/renderWithAuthSession';

const listAdminOrders = vi.fn();
const updateAdminOrderStatus = vi.fn();

vi.mock('../src/api/adminOrders.js', () => ({
    listAdminOrders: (...args) => listAdminOrders(...args),
    updateAdminOrderStatus: (...args) => updateAdminOrderStatus(...args),
}));

const session = {
    isAuthenticated: true,
    token: 'token-123',
    userId: 'admin-1',
    role: 'ADMIN',
    permissions: ['ORDERS_MANAGE'],
};

const baseOrder = {
    createdAt: new Date().toISOString(),
    paymentStatus: 'PAID',
    totals: { total: 99, currency: 'SEK' },
    customer: { name: 'Test Buyer', email: 'buyer@example.com' },
};

describe('AdminOrders cancelled visibility rules', () => {
    beforeEach(() => {
        listAdminOrders.mockReset();
        updateAdminOrderStatus.mockReset();
    });

    it('hides cancelled orders by default, but shows them when toggled or explicitly filtered', async () => {
        listAdminOrders.mockResolvedValue([
            { ...baseOrder, id: 'order-active', orderNumber: '1001', status: 'RECEIVED' },
            { ...baseOrder, id: 'order-cancelled', orderNumber: '1002', status: 'CANCELLED_BY_CUSTOMER' },
            { ...baseOrder, id: 'order-cancelled-alt', orderNumber: '1003', status: 'CANCELLED' },
        ]);

        renderWithAuthSession(<AdminOrders />, { session });

        await screen.findByText('#1001');
        expect(screen.queryByText('#1002')).toBeNull();
        expect(screen.queryByText('#1003')).toBeNull();

        fireEvent.click(screen.getByLabelText(/Show cancelled orders/i));

        await screen.findByText('#1002');
        await screen.findByText('#1003');

        fireEvent.click(screen.getByLabelText(/Show cancelled orders/i));
        await waitFor(() => {
            expect(screen.queryByText('#1002')).toBeNull();
            expect(screen.queryByText('#1003')).toBeNull();
        });

        fireEvent.change(screen.getByDisplayValue('All statuses'), { target: { value: 'CANCELLED' } });

        await screen.findByText('#1002');
        await screen.findByText('#1003');
        expect(screen.queryByText('#1001')).toBeNull();
    });
});
