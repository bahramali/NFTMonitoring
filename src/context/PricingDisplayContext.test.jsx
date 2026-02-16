import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingDisplayProvider, usePricingDisplay } from './PricingDisplayContext.jsx';

const { fetchCustomerProfileMock, fetchStoreConfigMock } = vi.hoisted(() => ({
    fetchCustomerProfileMock: vi.fn(),
    fetchStoreConfigMock: vi.fn(),
}));

vi.mock('../api/customer.js', () => ({
    fetchCustomerProfile: fetchCustomerProfileMock,
    updateCustomerProfile: vi.fn(),
}));

vi.mock('../api/store.js', () => ({
    fetchStoreConfig: fetchStoreConfigMock,
}));

vi.mock('./AuthContext.jsx', () => ({
    useAuth: () => ({
        isAuthenticated: true,
        token: 'token-1',
        profile: {},
    }),
}));

function Probe() {
    const { customerType, priceDisplayMode } = usePricingDisplay();
    return (
        <div>
            <span data-testid="customerType">{customerType}</span>
            <span data-testid="priceDisplayMode">{priceDisplayMode}</span>
        </div>
    );
}

describe('PricingDisplayContext', () => {
    beforeEach(() => {
        fetchCustomerProfileMock.mockReset();
        fetchStoreConfigMock.mockReset();
        window.localStorage.clear();
        fetchStoreConfigMock.mockResolvedValue({ defaultVatRate: 0.25 });
        fetchCustomerProfileMock.mockResolvedValue({
            user: {
                companyName: 'Acme AB',
                orgNumber: '5566778899',
            },
        });
    });

    it('switches to EXKL_MOMS mode when server profile includes company details', async () => {
        render(
            <PricingDisplayProvider>
                <Probe />
            </PricingDisplayProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('customerType')).toHaveTextContent('B2B');
            expect(screen.getByTestId('priceDisplayMode')).toHaveTextContent('EXKL_MOMS');
        });
    });
});
