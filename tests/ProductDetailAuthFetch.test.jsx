import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductDetail from '../src/pages/store/ProductDetail.jsx';

const fetchStoreProduct = vi.fn();
let authSession = { profile: null, isAuthenticated: false, token: null };

vi.mock('../src/api/store.js', () => ({
    fetchStoreProduct: (...args) => fetchStoreProduct(...args),
}));

vi.mock('../src/context/StorefrontContext.jsx', () => ({
    useStorefront: () => ({
        addToCart: vi.fn(),
        pendingProductId: null,
    }),
}));

vi.mock('../src/context/AuthContext.jsx', () => ({
    useAuth: () => authSession,
}));

afterEach(() => {
    fetchStoreProduct.mockReset();
    authSession = { profile: null, isAuthenticated: false, token: null };
});

describe('ProductDetail auth-aware fetch', () => {
    const renderPage = () => render(
        <MemoryRouter initialEntries={['/store/product/p-1']}>
            <Routes>
                <Route path="/store/product/:productId" element={<ProductDetail />} />
            </Routes>
        </MemoryRouter>,
    );

    it('uses anonymous fetch when not authenticated', async () => {
        fetchStoreProduct.mockResolvedValue({ product: { id: 'p-1', name: 'Basil', variants: [] } });
        renderPage();

        await waitFor(() => {
            expect(fetchStoreProduct).toHaveBeenCalledWith('p-1', { token: null });
        });
    });

    it('uses token fetch when authenticated', async () => {
        authSession = { profile: { pricingTier: 'VIP' }, isAuthenticated: true, token: 'jwt-2' };
        fetchStoreProduct.mockResolvedValue({ product: { id: 'p-1', name: 'Basil', variants: [] } });
        renderPage();

        await waitFor(() => {
            expect(fetchStoreProduct).toHaveBeenCalledWith('p-1', { token: 'jwt-2' });
        });
    });
});
