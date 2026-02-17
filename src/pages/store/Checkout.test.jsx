import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Checkout from './Checkout.jsx';
import { fetchCustomerProfile } from '../../api/customer.js';
import { fetchCustomerAddresses } from '../../api/customerAddresses.js';

const redirectToLoginMock = vi.fn();
const storefrontState = {
    cart: {
        items: [{ id: 'item-1', name: 'Leaf', quantity: 1, unitPrice: 100 }],
        totals: { gross: 100, net: 80, vat: 20, shipping: 0, currency: 'SEK' },
    },
};
const authState = {
    isAuthenticated: false,
    token: null,
    logout: vi.fn(),
    profile: {},
};

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
    useAuth: () => authState,
}));
vi.mock('../../context/StorefrontContext.jsx', () => ({
    useStorefront: () => ({
        cart: storefrontState.cart,
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
        storefrontState.cart = {
            items: [{ id: 'item-1', name: 'Leaf', quantity: 1, unitPrice: 100 }],
            totals: { gross: 100, net: 80, vat: 20, shipping: 0, currency: 'SEK' },
        };
        authState.isAuthenticated = false;
        authState.token = null;
        authState.profile = {};
        redirectToLoginMock.mockReset();
        vi.mocked(fetchCustomerProfile).mockReset();
        vi.mocked(fetchCustomerProfile).mockResolvedValue(null);
        vi.mocked(fetchCustomerAddresses).mockReset();
        vi.mocked(fetchCustomerAddresses).mockResolvedValue([]);
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

    it('prefills business purchase fields from profile without overwriting typed values', async () => {
        authState.isAuthenticated = true;
        authState.token = 'token-1';
        vi.mocked(fetchCustomerProfile).mockResolvedValue({
            user: {
                email: 'buyer@example.com',
                companyName: 'Acme AB',
                organizationNumber: '556677-8899',
                vatNumber: 'SE556677889901',
                invoiceEmail: 'billing@acme.se',
            },
        });

        render(
            <MemoryRouter>
                <Checkout />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByLabelText('Company / Restaurant (B2B)'));

        await waitFor(() => {
            expect(screen.getByLabelText('Company name')).toHaveValue('Acme AB');
            expect(screen.getByLabelText('Organization number')).toHaveValue('556677-8899');
            expect(screen.getByLabelText('VAT number (optional)')).toHaveValue('SE556677889901');
            expect(screen.getByLabelText('Invoice email (optional)')).toHaveValue('billing@acme.se');
        });

        fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Typed Company' } });

        await waitFor(() => {
            expect(screen.getByLabelText('Company name')).toHaveValue('Typed Company');
        });
    });

    it('disables invoice pay later when invoice eligibility is false and shows helper text', async () => {
        authState.isAuthenticated = true;
        authState.token = 'token-1';
        storefrontState.cart = {
            ...storefrontState.cart,
            invoicePayLaterEligible: false,
        };

        render(
            <MemoryRouter>
                <Checkout />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByLabelText('Company / Restaurant (B2B)'));

        const invoiceOption = await screen.findByLabelText('Invoice (pay later)');
        expect(invoiceOption).toBeDisabled();
        expect(screen.getByText('Invoice is available only for approved business customers.')).toBeInTheDocument();
    });

    it('allows selecting invoice pay later when invoice eligibility is true', async () => {
        authState.isAuthenticated = true;
        authState.token = 'token-1';
        storefrontState.cart = {
            ...storefrontState.cart,
            invoicePayLaterEligible: true,
        };

        render(
            <MemoryRouter>
                <Checkout />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByLabelText('Company / Restaurant (B2B)'));
        const invoiceOption = await screen.findByLabelText('Invoice (pay later)');

        fireEvent.click(invoiceOption);
        expect(invoiceOption).toBeChecked();
        expect(screen.queryByText('Invoice is available only for approved business customers.')).not.toBeInTheDocument();
    });
});
