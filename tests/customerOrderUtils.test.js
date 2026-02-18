import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CustomerOrderDetails from '../src/pages/customer/CustomerOrderDetails.jsx';
import { canCancelOrder, normalizeOrder } from '../src/pages/customer/orderUtils.js';

const fetchOrderDetail = vi.fn();
const cancelMyOrder = vi.fn();
const emailOrderInvoice = vi.fn();
const fetchOrderInvoiceHtml = vi.fn();
const fetchOrderInvoicePdf = vi.fn();
const fetchOrderReceiptHtml = vi.fn();
const loadOrders = vi.fn();
const redirectToLogin = vi.fn();

vi.mock('../src/api/customer.js', () => ({
    fetchOrderDetail: (...args) => fetchOrderDetail(...args),
    cancelMyOrder: (...args) => cancelMyOrder(...args),
    emailOrderInvoice: (...args) => emailOrderInvoice(...args),
    fetchOrderInvoiceHtml: (...args) => fetchOrderInvoiceHtml(...args),
    fetchOrderInvoicePdf: (...args) => fetchOrderInvoicePdf(...args),
    fetchOrderReceiptHtml: (...args) => fetchOrderReceiptHtml(...args),
}));

vi.mock('../src/context/AuthContext.jsx', () => ({
    useAuth: () => ({ token: 'token-1' }),
}));

vi.mock('../src/hooks/useRedirectToLogin.js', () => ({
    default: () => redirectToLogin,
}));

const renderOrderDetails = () => render(
    React.createElement(
        MemoryRouter,
        { initialEntries: ['/customer/orders/ord-1'] },
        React.createElement(
            Routes,
            null,
            React.createElement(
                Route,
                {
                    path: '/customer',
                    element: React.createElement(Outlet, { context: { ordersState: { items: [] }, loadOrders } }),
                },
                React.createElement(Route, {
                    path: 'orders/:orderId',
                    element: React.createElement(CustomerOrderDetails),
                }),
            ),
        ),
    ),
);

describe('normalizeOrder payment fields', () => {
    beforeEach(() => {
        fetchOrderDetail.mockReset();
        cancelMyOrder.mockReset();
        emailOrderInvoice.mockReset();
        fetchOrderInvoiceHtml.mockReset();
        fetchOrderInvoicePdf.mockReset();
        fetchOrderReceiptHtml.mockReset();
        loadOrders.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('reads payment method/reference from flat fields', () => {
        const order = normalizeOrder({
            id: 'ord-1',
            paymentStatus: 'PAID',
            paymentMethod: 'Card',
            paymentReference: 'pi_123',
        });

        expect(order.paymentStatus).toBe('PAID');
        expect(order.paymentMethod).toBe('Card');
        expect(order.paymentReference).toBe('pi_123');
    });

    it('reads payment method/reference from nested payment fields', () => {
        const order = normalizeOrder({
            id: 'ord-2',
            payment: {
                status: 'PAID',
                method: 'Swish',
                reference: 'txn_789',
            },
        });

        expect(order.paymentStatus).toBe('PAID');
        expect(order.paymentMethod).toBe('Swish');
        expect(order.paymentReference).toBe('txn_789');
    });

    it('defaults method/reference for invoice mode when missing', () => {
        const order = normalizeOrder({
            id: 'ord-3',
            paymentMode: 'invoice-pay-later',
            invoiceNumber: 'INV-42',
        });

        expect(order.paymentMode).toBe('INVOICE_PAY_LATER');
        expect(order.paymentMethod).toBe('Invoice');
        expect(order.paymentReference).toBe('INV-42');
    });
});

describe('normalizeOrder totals', () => {
    it('reads VAT from moms totals fields', () => {
        const order = normalizeOrder({
            id: 'ord-moms',
            totals: {
                total: 125,
                moms: 25,
            },
        });

        expect(order.totals.tax).toBe(25);
    });

    it('reads VAT from vat cents totals fields', () => {
        const order = normalizeOrder({
            id: 'ord-vat',
            totals: {
                totalCents: 12500,
                vatCents: 2500,
            },
        });

        expect(order.totals.tax).toBe(25);
    });
});

describe('canCancelOrder', () => {
    it('returns true for pending orders', () => {
        expect(canCancelOrder('pending payment')).toBe(true);
        expect(canCancelOrder('PROCESSING')).toBe(true);
        expect(canCancelOrder('RECEIVED')).toBe(true);
    });

    it('returns false for final states', () => {
        expect(canCancelOrder('completed')).toBe(false);
        expect(canCancelOrder('CANCELLED_BY_CUSTOMER')).toBe(false);
    });

    it('keeps cancel enabled for received order details', async () => {
        fetchOrderDetail.mockResolvedValue({
            id: 'ord-1',
            orderNumber: '1001',
            status: 'RECEIVED',
            createdAt: '2026-01-01T00:00:00.000Z',
            totals: { total: 99 },
            items: [{ name: 'Sensor', quantity: 1, price: 99, lineTotal: 99 }],
        });

        renderOrderDetails();

        await waitFor(() => {
            expect(fetchOrderDetail).toHaveBeenCalled();
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByRole('button', { name: 'Cancel order' })).toBeEnabled();
    });
});
