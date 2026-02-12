import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CustomerDetails from '../src/pages/store/CustomerDetails.jsx';
import { renderWithAuthSession } from './utils/renderWithAuthSession';

const createJsonResponse = ({ ok = true, status = 200, body = {} } = {}) => ({
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

const renderCustomerDetailsPage = () =>
    renderWithAuthSession(
        <MemoryRouter initialEntries={['/store/admin/customers/cust-1']}>
            <Routes>
                <Route path="/store/admin/customers/:customerId" element={<CustomerDetails />} />
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
});

describe('CustomerDetails coupon resend behavior', () => {
    it('disables resend for legacy coupons with unavailable code value', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            if (url.includes('/api/admin/customers/cust-1/coupons')) {
                return createJsonResponse({
                    body: {
                        coupons: [{
                            id: 'coupon-legacy',
                            variantLabel: 'Starter 100g',
                            amountOffCents: 1000,
                            status: 'ACTIVE',
                            createdAt: '2026-02-11T10:00:00Z',
                            expiresAt: '2026-03-11T10:00:00Z',
                            codeAvailable: false,
                            codeValue: '',
                        }],
                    },
                });
            }

            if (url.includes('/api/admin/customers/cust-1')) {
                return createJsonResponse({
                    body: { customer: { id: 'cust-1', email: 'legacy@example.com', orders: [] } },
                });
            }

            if (url.includes('/api/admin/products')) {
                return createJsonResponse({ body: { products: [] } });
            }

            return createJsonResponse({ body: {} });
        }));

        renderCustomerDetailsPage();

        const resendButton = await screen.findByRole('button', { name: 'Resend' });
        expect(resendButton).toBeDisabled();
        expect(resendButton).toHaveAttribute(
            'title',
            'Code value isn’t available for this legacy coupon. Use Renew to generate a new code.',
        );
    });

    it('opens renew modal automatically on COUPON_CODE_NOT_AVAILABLE resend error', async () => {
        window.confirm = vi.fn(() => true);

        vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
            if (url.includes('/api/admin/customers/cust-1/coupons/coupon-active/resend') && options.method === 'POST') {
                return createJsonResponse({
                    ok: false,
                    status: 409,
                    body: {
                        code: 'COUPON_CODE_NOT_AVAILABLE',
                        message: 'Code value unavailable',
                    },
                });
            }

            if (url.includes('/api/admin/customers/cust-1/coupons')) {
                return createJsonResponse({
                    body: {
                        coupons: [{
                            id: 'coupon-active',
                            variantLabel: 'Starter 100g',
                            amountOffCents: 1000,
                            status: 'ACTIVE',
                            createdAt: '2026-02-11T10:00:00Z',
                            expiresAt: '2026-03-11T10:00:00Z',
                            codeAvailable: true,
                            codeValue: 'ABC123',
                        }],
                    },
                });
            }

            if (url.includes('/api/admin/customers/cust-1')) {
                return createJsonResponse({
                    body: { customer: { id: 'cust-1', email: 'legacy@example.com', orders: [] } },
                });
            }

            if (url.includes('/api/admin/products')) {
                return createJsonResponse({ body: { products: [] } });
            }

            return createJsonResponse({ body: {} });
        }));

        renderCustomerDetailsPage();

        const resendButton = await screen.findByRole('button', { name: 'Resend' });
        fireEvent.click(resendButton);

        await screen.findByRole('dialog', { name: 'Renew coupon' });
        await waitFor(() => {
            expect(
                screen.getByText('Code value isn’t available for this legacy coupon. Use Renew to generate a new code.'),
            ).toBeInTheDocument();
        });
    });
});
