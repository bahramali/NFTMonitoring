import React from 'react';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import CustomersList from '../src/pages/store/CustomersList.jsx';
import { renderWithAuthSession } from './utils/renderWithAuthSession';
import { listAdminCustomers } from '../src/api/adminCustomers.js';

vi.mock('../src/api/adminCustomers.js', () => ({
    listAdminCustomers: vi.fn(),
    normalizeCustomerId: (id) => `${id ?? ''}`.trim(),
}));

const renderCustomersPage = () =>
    renderWithAuthSession(
        <MemoryRouter initialEntries={['/store/admin/customers']}>
            <Routes>
                <Route path="/store/admin/customers" element={<CustomersList />} />
            </Routes>
        </MemoryRouter>,
        {
            session: {
                isAuthenticated: true,
                token: 'token-123',
                userId: 'admin-1',
                role: 'ADMIN',
                permissions: ['STORE_ADMIN'],
            },
        },
    );

afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
});

beforeEach(() => {
    listAdminCustomers.mockResolvedValue({
        customers: [
            {
                id: '7',
                name: 'Adel Jalali',
                email: 'adel@example.com',
                status: 'Active',
                type: 'REGISTERED',
                userId: '7',
                pricingTier: 'VIP',
                totalSpent: 29.9,
                currency: 'SEK',
            },
            {
                id: '8',
                name: 'Ali Bahramali',
                email: 'ali@example.com',
                status: 'Active',
                type: 'GUEST',
                userId: 'guest_8',
                pricingTier: '',
                totalSpent: 0,
                currency: 'SEK',
            },
        ],
        totalCustomers: 2,
        activeCustomers: 2,
        totalPages: 1,
    });
});

describe('CustomersList pricing tier badges', () => {
    it('shows pricing tier next to each customer name', async () => {
        renderCustomersPage();

        await screen.findByText('Adel Jalali');

        expect(screen.getByText('VIP')).toBeInTheDocument();
        expect(screen.getByText('Default')).toBeInTheDocument();
    });
});
