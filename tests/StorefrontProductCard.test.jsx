import React from 'react';
import { render, screen, act, renderHook, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../src/components/store/ProductCard.jsx';
import { StorefrontProvider, useStorefront } from '../src/context/StorefrontContext.jsx';
import { STOREFRONT_CART_RESET_EVENT, STOREFRONT_CART_STORAGE_KEY } from '../src/utils/storefrontSession.js';

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


    it('shows supporter tier pricing with struck-through default price', () => {
        mockProfile = { pricingTier: 'SUPPORTER' };
        const product = {
            id: 'p-tier-1',
            name: 'Tiered Basil',
            currency: 'SEK',
            variants: [
                {
                    id: 'v-1',
                    label: '50g',
                    priceCents: 2000,
                    priceSek: 20,
                    stock: 4,
                    tierPrices: {
                        DEFAULT: 2990,
                        SUPPORTER: 2000,
                    },
                },
            ],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        const regularPrice = screen.getByText('29,90 kr');
        expect(regularPrice).toBeInTheDocument();
        expect(regularPrice.className).toContain('priceOldInvalid');
        expect(screen.getByText('20,00 kr')).toBeInTheDocument();
        expect(screen.getByText('Supporter price')).toBeInTheDocument();
    });


    it('shows only effective price for DEFAULT tier', () => {
        mockProfile = { pricingTier: 'DEFAULT' };
        const product = {
            id: 'p-tier-2',
            name: 'Tiered Basil Partial',
            currency: 'SEK',
            variants: [
                {
                    id: 'v-1',
                    label: '50g',
                    priceCents: 2990,
                    priceSek: 29.9,
                    stock: 4,
                    tierPrices: {
                        DEFAULT: 2990,
                        SUPPORTER: 2000,
                    },
                },
            ],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.queryByText('Supporter price')).not.toBeInTheDocument();
        expect(screen.getByText('29,90 kr')).toBeInTheDocument();
        expect(screen.queryByText('20,00 kr')).not.toBeInTheDocument();
    });


    it('shows only effective price when tier is non-default but tier price is missing or zero', () => {
        mockProfile = { pricingTier: 'SUPPORTER' };
        const product = {
            id: 'p-tier-3',
            name: 'Tiered Basil Invalid',
            currency: 'SEK',
            variants: [
                {
                    id: 'v-1',
                    label: '50g',
                    priceCents: 2990,
                    priceSek: 29.9,
                    stock: 4,
                    tierPrices: {
                        DEFAULT: 2990,
                        SUPPORTER: 0,
                    },
                },
            ],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.getByText('29,90 kr')).toBeInTheDocument();
        expect(screen.queryByText('Supporter price')).not.toBeInTheDocument();
        expect(screen.getByText('29,90 kr').className).not.toContain('priceOldInvalid');
    });


    it('shows only effective price when tier price equals default', () => {
        mockProfile = { pricingTier: 'SUPPORTER' };
        const product = {
            id: 'p-tier-4',
            name: 'Tiered Basil Equal',
            currency: 'SEK',
            variants: [
                {
                    id: 'v-1',
                    label: '50g',
                    priceCents: 2990,
                    priceSek: 29.9,
                    stock: 4,
                    tierPrices: {
                        DEFAULT: 2990,
                        SUPPORTER: 2990,
                    },
                },
            ],
        };

        render(
            <MemoryRouter>
                <ProductCard product={product} />
            </MemoryRouter>,
        );

        expect(screen.getByText('29,90 kr')).toBeInTheDocument();
        expect(screen.queryByText('Supporter price')).not.toBeInTheDocument();
        expect(screen.getByText('29,90 kr').className).not.toContain('priceOldInvalid');
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

    it('resets cart/session on logout event and forces next add to use a fresh cart', async () => {
        let createCount = 0;
        const fetchSpy = vi.fn(async (url, options = {}) => {
            const requestUrl = typeof url === 'string' ? url : url?.toString();

            if (requestUrl?.endsWith('/api/store/cart') && (options?.method === 'POST' || !options?.method)) {
                if ((options?.method || 'GET') === 'GET') {
                    return createJsonResponse({ cartId: 'cart-anon', sessionId: 'session-anon', items: [] });
                }

                createCount += 1;
                const cartId = createCount === 1 ? 'cart-old' : 'cart-new';
                const sessionId = createCount === 1 ? 'session-old' : 'session-new';
                return createJsonResponse({ cartId, sessionId, items: [] });
            }

            if (requestUrl?.includes('/api/store/cart/') && requestUrl?.includes('/items') && options?.method === 'POST') {
                const body = JSON.parse(options.body ?? '{}');
                const isFresh = requestUrl.includes('/cart-new/');
                return createJsonResponse({
                    cart: {
                        id: isFresh ? 'cart-new' : 'cart-old',
                        sessionId: isFresh ? 'session-new' : 'session-old',
                        items: [{ id: `item-${createCount}`, itemId: body.variantId, quantity: body.quantity, price: 29 }],
                        totals: { currency: 'SEK', subtotal: 29, total: 29 },
                    },
                });
            }

            if (requestUrl?.includes('/api/store/cart/')) {
                return createJsonResponse({ cartId: 'cart-old', sessionId: 'session-old', items: [] });
            }

            return createJsonResponse({});
        });

        vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => fetchSpy(url, options)));
        const wrapper = ({ children }) => <StorefrontProvider>{children}</StorefrontProvider>;
        const { result } = renderHook(() => useStorefront(), { wrapper });

        await act(async () => {
            await result.current.addToCart('variant-1', 1, 'product-1');
        });
        expect(result.current.cartId).toBe('cart-old');
        expect(window.localStorage.getItem(STOREFRONT_CART_STORAGE_KEY)).toContain('cart-old');

        await act(async () => {
            window.dispatchEvent(new Event(STOREFRONT_CART_RESET_EVENT));
        });

        expect(result.current.cart).toBe(null);
        expect(result.current.cartId).toBe(null);
        expect(window.localStorage.getItem(STOREFRONT_CART_STORAGE_KEY)).toBe(null);

        await act(async () => {
            await result.current.addToCart('variant-1', 1, 'product-1');
        });

        const itemCallUrls = fetchSpy.mock.calls
            .map(([requestUrl]) => `${requestUrl}`)
            .filter((requestUrl) => requestUrl.includes('/api/store/cart/') && requestUrl.includes('/items'));

        expect(itemCallUrls[itemCallUrls.length - 1]).toContain('/cart-new/items');
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/store/cart'), expect.objectContaining({ method: 'GET' }));
    });
});
