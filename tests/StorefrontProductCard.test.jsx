import React from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../src/components/store/ProductCard.jsx';
import { StorefrontProvider, useStorefront } from '../src/context/StorefrontContext.jsx';

const createJsonResponse = (data) => ({
    ok: true,
    status: 200,
    bodyUsed: false,
    headers: {
        get: () => 'application/json',
    },
    clone() {
        return this;
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
});

afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
});

describe('ProductCard', () => {
    it('shows out of stock state and disables add', () => {
        const product = {
            id: 'p-1',
            name: 'Test Item',
            price: 29,
            currency: 'SEK',
            stock: 0,
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.getByText('Out of stock')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    });

    it('splits long titles into title and badge', () => {
        const product = {
            id: 'p-2',
            name: 'Fresh Basil 50g – Improved Genovese',
            price: 29,
            currency: 'SEK',
            stock: 12,
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: 'Fresh Basil 50g' })).toBeInTheDocument();
        expect(screen.getByText('Improved Genovese')).toBeInTheDocument();
    });
});

describe('Storefront add to cart', () => {
    it('updates cart badge data and shows toast after add', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
            const requestUrl = typeof url === 'string' ? url : url?.toString();
            if (requestUrl?.includes('/api/store/cart') && options?.method === 'POST') {
                if (requestUrl.includes('/items')) {
                    return createJsonResponse({
                        cart: {
                            id: 'cart-1',
                            sessionId: 'session-1',
                            items: [{ id: 'item-1', productId: 'product-1', quantity: 2, price: 29 }],
                            totals: { currency: 'SEK', subtotal: 58, total: 58 },
                        },
                    });
                }

                return createJsonResponse({ cartId: 'cart-1', sessionId: 'session-1', items: [] });
            }

            return createJsonResponse({});
        }));

        const wrapper = ({ children }) => <StorefrontProvider>{children}</StorefrontProvider>;
        const { result } = renderHook(() => useStorefront(), { wrapper });

        await act(async () => {
            await result.current.addToCart('product-1', 2);
        });

        expect(result.current.cart?.items?.[0]?.quantity).toBe(2);
        expect(result.current.toast?.message).toBe('Added to cart');
    });
});
