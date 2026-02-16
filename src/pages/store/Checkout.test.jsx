import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Checkout from './Checkout.jsx';

const redirectToLoginMock = vi.fn();

vi.mock('../../api/customerAddresses.js', () => ({
    createCustomerAddress: vi.fn(),
    fetchCustomerAddresses: vi.fn(),
    setDefaultCustomerAddress: vi.fn(),
}));
vi.mock('../../api/customer.js', () => ({
    fetchCustomerProfile: vi.fn(),
}));
vi.mock('../../api/store.js', () => ({
    applyStoreCoupon: vi.fn(),
    checkoutCart: vi.fn(),
    createStripeCheckoutSession: vi.fn(),
    fetchStoreCart: vi.fn(),
    normalizeCartResponse: (payload) => payload,
}));
vi.mock('../../context/AuthContext.jsx', () => ({
    useAuth: () => ({
        isAuthenticated: false,
        token: null,
        logout: vi.fn(),
        profile: {},
    }),
}));
vi.mock('../../context/StorefrontContext.jsx', () => ({
    useStorefront: () => ({
        cart: {
            items: [{ id: 'item-1', name: 'Leaf', quantity: 1, unitPrice: 100 }],
            totals: { gross: 100, net: 80, vat: 20, shipping: 0, currency: 'SEK' },
        },
        cartId: 'cart-1',
        sessionId: 'session-1',
        notify: vi.fn(),
        refreshCart: vi.fn(async () => {}),
    }),
}));
vi.mock('../../context/PricingDisplayContext.jsx', () => ({
    usePricingDisplay: () => ({
        customerType: 'B2C',
        priceDisplayMode: 'INKL_MOMS',
        vatRate: 0.25,
        setCustomerType: vi.fn(),
        setCompanyProfile: vi.fn(),
    }),
}));
vi.mock('../../hooks/useRedirectToLogin.js', () => ({
    default: () => redirectToLoginMock,
}));

describe('Checkout B2B login enforcement', () => {
    beforeEach(() => {
        redirectToLoginMock.mockReset();
    });

    it('prompts guest users to log in when company purchase is selected', async () => {
        render(
            <MemoryRouter>
                <Checkout />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByLabelText('Company / Restaurant (B2B)'));

        expect(screen.getByText('Please log in to buy as a company.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Log in and continue' }));

        expect(redirectToLoginMock).toHaveBeenCalled();
    });
});
