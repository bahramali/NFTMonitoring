import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerSettings from './CustomerSettings.jsx';

const {
    updateCustomerProfileMock,
    setCustomerTypeMock,
    setCompanyProfileMock,
    refreshPricingProfileMock,
    refreshProfileMock,
    outletContextValue,
    pricingContextValue,
} = vi.hoisted(() => ({
    updateCustomerProfileMock: vi.fn(),
    setCustomerTypeMock: vi.fn(),
    setCompanyProfileMock: vi.fn(),
    refreshPricingProfileMock: vi.fn(),
    refreshProfileMock: vi.fn(),
    outletContextValue: {
        profile: {
            email: 'person@example.com',
            raw: { fullName: 'Test User', phoneNumber: '0700000000' },
        },
        loadingProfile: false,
        redirectToLogin: vi.fn(),
        refreshProfile: vi.fn(),
    },
    pricingContextValue: {
        customerType: 'B2C',
        companyProfile: {
            companyName: '',
            orgNumber: '',
            vatNumber: '',
            invoiceEmail: 'person@example.com',
        },
        setCustomerType: vi.fn(),
        setCompanyProfile: vi.fn(),
        refreshPricingProfile: vi.fn(),
    },
}));

vi.mock('react-router-dom', () => ({
    useOutletContext: () => ({ ...outletContextValue, refreshProfile: refreshProfileMock }),
}));

vi.mock('../../api/customer.js', () => ({
    updateCustomerProfile: updateCustomerProfileMock,
}));

vi.mock('../../context/AuthContext.jsx', () => ({
    useAuth: () => ({ token: 'token-1' }),
}));

vi.mock('../../context/PricingDisplayContext.jsx', () => ({
    usePricingDisplay: () => ({
        ...pricingContextValue,
        setCustomerType: setCustomerTypeMock,
        setCompanyProfile: setCompanyProfileMock,
        refreshPricingProfile: refreshPricingProfileMock,
    }),
}));

vi.mock('../../hooks/usePasswordReset.js', () => ({
    default: () => ({
        resetState: { status: 'idle', message: '' },
        resetError: '',
        resetDisabled: false,
        handlePasswordReset: vi.fn(),
    }),
}));

describe('CustomerSettings company upgrade', () => {
    beforeEach(() => {
        updateCustomerProfileMock.mockReset();
        setCustomerTypeMock.mockReset();
        setCompanyProfileMock.mockReset();
        refreshPricingProfileMock.mockReset();
        refreshProfileMock.mockReset();
        updateCustomerProfileMock.mockResolvedValue({ ok: true });
    });

    it('saves company profile to /api/me with normalized org number and updates pricing mode', async () => {
        render(<CustomerSettings />);

        fireEvent.click(screen.getByLabelText('Company (exkl. moms)'));
        fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Acme AB' } });
        fireEvent.change(screen.getByLabelText('Organization number'), { target: { value: '556677-8899' } });
        fireEvent.change(screen.getByLabelText('VAT number (optional)'), { target: { value: 'SE556677889901' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save company profile' }));

        await waitFor(() => {
            expect(updateCustomerProfileMock).toHaveBeenCalledWith(
                'token-1',
                {
                    companyName: 'Acme AB',
                    orgNumber: '5566778899',
                    vatNumber: 'SE556677889901',
                    invoiceEmail: 'person@example.com',
                },
                expect.any(Object),
            );
        });

        expect(setCustomerTypeMock).toHaveBeenCalledWith('B2B', expect.objectContaining({ persistProfile: false }));
        expect(setCompanyProfileMock).toHaveBeenCalled();
        expect(refreshPricingProfileMock).toHaveBeenCalled();
    });
});
