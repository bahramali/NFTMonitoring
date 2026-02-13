import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Storefront from '../src/pages/store/Storefront.jsx';

const listStoreProducts = vi.fn();
let authSession = { isAuthenticated: false, token: null };

vi.mock('../src/api/store.js', () => ({
    listStoreProducts: (...args) => listStoreProducts(...args),
}));

vi.mock('../src/context/AuthContext.jsx', () => ({
    useAuth: () => authSession,
}));

vi.mock('../src/context/StorefrontContext.jsx', () => ({
    useStorefront: () => ({
        addToCart: vi.fn(),
        pendingProductId: null,
    }),
}));

vi.mock('../src/components/store/ProductCard.jsx', () => ({
    default: () => <div>product</div>,
}));

afterEach(() => {
    listStoreProducts.mockReset();
    authSession = { isAuthenticated: false, token: null };
});

describe('Storefront auth-aware product fetch', () => {
    it('uses public fetch for anonymous users', async () => {
        listStoreProducts.mockResolvedValue({ products: [] });
        render(<MemoryRouter><Storefront /></MemoryRouter>);

        await waitFor(() => {
            expect(listStoreProducts).toHaveBeenCalledWith({ token: null });
        });
    });

    it('uses authenticated fetch when user is logged in', async () => {
        authSession = { isAuthenticated: true, token: 'jwt-1' };
        listStoreProducts.mockResolvedValue({ products: [] });
        render(<MemoryRouter><Storefront /></MemoryRouter>);

        await waitFor(() => {
            expect(listStoreProducts).toHaveBeenCalledWith({ token: 'jwt-1' });
        });
    });
});
