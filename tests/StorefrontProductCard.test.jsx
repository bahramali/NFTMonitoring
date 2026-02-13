import React from 'react';
import { render, screen, act, renderHook, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../src/components/store/ProductCard.jsx';
import { StorefrontProvider, useStorefront } from '../src/context/StorefrontContext.jsx';

let mockProfile = null;

vi.mock('../src/context/AuthContext.jsx', () => ({
    useAuth: () => ({ profile: mockProfile }),
}));

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
    mockProfile = null;
});

describe('ProductCard', () => {
    it('shows out of stock state and disables add', () => {
        const product = {
            id: 'p-1',
            name: 'Test Item',
            currency: 'SEK',
            variants: [
                { id: 'v-1', label: '50g', price: 29, stock: 0 },
                { id: 'v-2', label: '70g', price: 39, stock: 0 },
            ],
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

    it('updates price and stock label when variant changes', async () => {
        const product = {
            id: 'p-3',
            name: 'Fresh Basil',
            currency: 'SEK',
            variants: [
                { id: 'v-1', label: '50g', price: 29, stock: 4 },
                { id: 'v-2', label: '70g', price: 39, stock: 0 },
            ],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.getByText('Only 4 left')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add' })).not.toBeDisabled();

        const option = screen.getByRole('button', { name: '70g' });
        await act(async () => {
            option.click();
        });

        expect(await screen.findByText('Out of stock')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
        expect(screen.getByText(/39/)).toBeInTheDocument();
    });


    it('resolves image with strict fallback chain and updates on variant change', async () => {
        const product = {
            id: 'p-img-1',
            name: 'Basil Image Test',
            currency: 'SEK',
            thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
            images: [{ url: 'https://cdn.example.com/gallery.jpg' }],
            variants: [
                { id: 'v-1', label: '50g', price: 29, stock: 3, imageUrl: 'https://cdn.example.com/v1.jpg' },
                { id: 'v-2', label: '70g', price: 39, stock: 2, imageUrl: 'https://cdn.example.com/v2.jpg' },
            ],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        const image = screen.getByRole('img', { name: 'Basil Image Test' });
        expect(image).toHaveAttribute('src', 'https://cdn.example.com/v1.jpg');
        expect(image).toHaveAttribute('data-image-source', 'selectedVariant.imageUrl');

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: '70g' }));
        });

        expect(screen.getByRole('img', { name: 'Basil Image Test' })).toHaveAttribute('src', 'https://cdn.example.com/v2.jpg');
        expect(screen.getByRole('img', { name: 'Basil Image Test' })).toHaveAttribute('data-image-source', 'selectedVariant.imageUrl');
    });

    it('falls back to thumbnail, primary image and first gallery image', () => {
        const { rerender } = render(
            <MemoryRouter>
                <ProductCard
                    product={{ id: 'p-img-2', name: 'Thumb Product', currency: 'SEK', thumbnailUrl: 'https://cdn.example.com/thumb.jpg' }}
                />
            </MemoryRouter>,
        );

        expect(screen.getByRole('img', { name: 'Thumb Product' })).toHaveAttribute('src', 'https://cdn.example.com/thumb.jpg');
        expect(screen.getByRole('img', { name: 'Thumb Product' })).toHaveAttribute('data-image-source', 'product.thumbnailUrl');

        rerender(
            <MemoryRouter>
                <ProductCard
                    product={{ id: 'p-img-3', name: 'Primary Product', currency: 'SEK', primaryImageUrl: 'https://cdn.example.com/primary.jpg' }}
                />
            </MemoryRouter>,
        );

        expect(screen.getByRole('img', { name: 'Primary Product' })).toHaveAttribute('src', 'https://cdn.example.com/primary.jpg');
        expect(screen.getByRole('img', { name: 'Primary Product' })).toHaveAttribute('data-image-source', 'product.primaryImageUrl');

        rerender(
            <MemoryRouter>
                <ProductCard
                    product={{ id: 'p-img-4', name: 'Gallery Product', currency: 'SEK', images: [{ url: 'https://cdn.example.com/gallery.jpg' }] }}
                />
            </MemoryRouter>,
        );

        expect(screen.getByRole('img', { name: 'Gallery Product' })).toHaveAttribute('src', 'https://cdn.example.com/gallery.jpg');
        expect(screen.getByRole('img', { name: 'Gallery Product' })).toHaveAttribute('data-image-source', 'product.images[0].url');
    });


    it('shows supporter tier price when variant does not include tier map but product does', () => {
        mockProfile = { pricingTier: 'SUPPORTER' };
        const product = {
            id: 'p-tier-1',
            name: 'Tiered Basil',
            currency: 'SEK',
            tierPricesSek: {
                DEFAULT: 29.9,
                SUPPORTER: 10,
            },
            variants: [
                { id: 'v-1', label: '50g', price: 29.9, stock: 4 },
            ],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.getByText('29,90 kr')).toBeInTheDocument();
        expect(screen.getByText('10,00 kr')).toBeInTheDocument();
        expect(screen.getByText('Supporter price')).toBeInTheDocument();
    });


    it('does not render tier delta UI when tier map lacks DEFAULT', () => {
        mockProfile = { pricingTier: 'SUPPORTER' };
        const product = {
            id: 'p-tier-2',
            name: 'Tiered Basil Partial',
            currency: 'SEK',
            price: 29.9,
            tierPricesSek: {
                SUPPORTER: 10,
            },
            variants: [
                { id: 'v-1', label: '50g', price: 29.9, stock: 4 },
            ],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.queryByText('Supporter price')).not.toBeInTheDocument();
        expect(screen.getByText('29,90 kr')).toBeInTheDocument();
        expect(screen.queryByText('10,00 kr')).not.toBeInTheDocument();
    });

    it('keeps view details link visible', () => {
        const product = {
            id: 'p-4',
            name: 'Fresh Basil',
            currency: 'SEK',
            variants: [{ id: 'v-1', label: '50g', price: 29, stock: 10 }],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.getByRole('link', { name: /View details/i })).toBeInTheDocument();
    });
});

describe('Storefront add to cart', () => {
    it('updates cart badge data and shows toast after add', async () => {
        const fetchSpy = vi.fn(async (url, options = {}) => {
            const requestUrl = typeof url === 'string' ? url : url?.toString();
            if (requestUrl?.includes('/api/store/cart') && options?.method === 'POST') {
                if (requestUrl.includes('/items')) {
                    const body = JSON.parse(options.body ?? '{}');
                    return createJsonResponse({
                        cart: {
                            id: 'cart-1',
                            sessionId: 'session-1',
                            items: [{ id: 'item-1', itemId: body.variantId, quantity: 2, price: 29 }],
                            totals: { currency: 'SEK', subtotal: 58, total: 58 },
                        },
                    });
                }

                return createJsonResponse({ cartId: 'cart-1', sessionId: 'session-1', items: [] });
            }

            return createJsonResponse({});
        });
        vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
            return fetchSpy(url, options);
        }));

        const wrapper = ({ children }) => <StorefrontProvider>{children}</StorefrontProvider>;
        const { result } = renderHook(() => useStorefront(), { wrapper });

        await act(async () => {
            await result.current.addToCart('variant-1', 2, 'product-1');
        });

        expect(result.current.cart?.items?.[0]?.quantity).toBe(2);
        expect(result.current.cart?.items?.[0]?.itemId).toBe('variant-1');
        expect(result.current.toast?.message).toBe('Added to cart');
        const call = fetchSpy.mock.calls.find(([url]) => `${url}`.includes('/items'));
        const body = JSON.parse(call?.[1]?.body ?? '{}');
        expect(body).toMatchObject({ variantId: 'variant-1', quantity: 2 });
    });
});
