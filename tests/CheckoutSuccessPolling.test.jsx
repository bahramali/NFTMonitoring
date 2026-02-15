import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutSuccess from '../src/pages/store/CheckoutSuccess.jsx';

const fetchStoreOrderBySession = vi.fn();
const fetchOrderStatus = vi.fn();
const clearCart = vi.fn();

vi.mock('../src/api/store.js', () => ({
    fetchStoreOrderBySession: (...args) => fetchStoreOrderBySession(...args),
    fetchOrderStatus: (...args) => fetchOrderStatus(...args),
}));

vi.mock('../src/context/StorefrontContext.jsx', () => ({
    useStorefront: () => ({
        clearCart,
    }),
}));

const renderPage = (path = '/store/checkout/success?session_id=sess-1') => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path="/store/checkout/success" element={<CheckoutSuccess />} />
        </Routes>
    </MemoryRouter>,
);

describe('CheckoutSuccess polling guards', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        fetchStoreOrderBySession.mockReset();
        fetchOrderStatus.mockReset();
        clearCart.mockReset();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('stops polling after payment is confirmed and clears the cart', async () => {
        fetchStoreOrderBySession.mockResolvedValue({
            data: { status: 'PAID' },
            correlationId: 'corr-1',
            status: 200,
        });

        renderPage();

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText('Order confirmed')).toBeInTheDocument();

        await act(async () => {
            vi.advanceTimersByTime(20000);
            await Promise.resolve();
        });

        expect(fetchStoreOrderBySession).toHaveBeenCalledTimes(1);
        expect(clearCart).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Your cart has been checked out.')).toBeInTheDocument();
    });

    it('stops polling after repeated server errors and supports manual retry', async () => {
        fetchStoreOrderBySession
            .mockRejectedValueOnce({ status: 500, message: 'Unexpected server error' })
            .mockRejectedValueOnce({ status: 502, message: 'Unexpected server error' })
            .mockRejectedValueOnce({ status: 503, message: 'Unexpected server error' })
            .mockResolvedValueOnce({ data: { status: 'processing' }, correlationId: 'corr-2', status: 202 });

        renderPage();

        await act(async () => {
            await Promise.resolve();
            vi.advanceTimersByTime(2000);
            await Promise.resolve();
            vi.advanceTimersByTime(2000);
            await Promise.resolve();
        });

        expect(fetchStoreOrderBySession).toHaveBeenCalledTimes(3);
        expect(screen.getByText('Unable to confirm payment right now. Please try again.')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
            await Promise.resolve();
        });

        expect(fetchStoreOrderBySession).toHaveBeenCalledTimes(4);
        expect(screen.queryByText('Unable to confirm payment right now. Please try again.')).not.toBeInTheDocument();
        expect(screen.getByText('Processing')).toBeInTheDocument();
    });
});
