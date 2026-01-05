import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    addItemToCart,
    checkoutCart as checkoutCartApi,
    createCheckoutSession as createCheckoutSessionApi,
    createStoreCart,
    fetchStoreCart,
    normalizeCartResponse,
    removeCartItem,
    updateCartItem,
} from '../api/store.js';

const STORAGE_KEY = 'storefrontCartSession';
const defaultState = {
    cart: null,
    cartId: null,
    sessionId: null,
};

const StorefrontContext = createContext({
    initializing: true,
    isCartOpen: false,
    cart: null,
    cartId: null,
    sessionId: null,
    toast: null,
    pendingProductId: null,
    pendingItemId: null,
    openCart: () => {},
    closeCart: () => {},
    refreshCart: async () => {},
    addToCart: async () => {},
    updateItemQuantity: async () => {},
    removeItem: async () => {},
    checkout: async () => ({}),
    createCheckoutSession: async () => ({}),
    clearToast: () => {},
});

const readStoredCartSession = () => {
    if (typeof window === 'undefined') return defaultState;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;

    try {
        const parsed = JSON.parse(raw);
        return {
            cartId: parsed.cartId || null,
            sessionId: parsed.sessionId || null,
        };
    } catch {
        return defaultState;
    }
};

const persistCartSession = (cartId, sessionId) => {
    if (typeof window === 'undefined') return;
    if (!cartId || !sessionId) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cartId, sessionId }));
};

const clearCartSession = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
};

export function StorefrontProvider({ children }) {
    const [cartState, setCartState] = useState(() => readStoredCartSession());
    const [cart, setCart] = useState(null);
    const [initializing, setInitializing] = useState(true);
    const [toast, setToast] = useState(null);
    const [pendingProductId, setPendingProductId] = useState(null);
    const [pendingItemId, setPendingItemId] = useState(null);
    const [isCartOpen, setIsCartOpen] = useState(false);

    const cartStateRef = useRef(cartState);
    const cartRef = useRef(cart);
    const didInitRef = useRef(false);
    const cartRequestRef = useRef(null);

    useEffect(() => {
        cartStateRef.current = cartState;
    }, [cartState]);

    useEffect(() => {
        cartRef.current = cart;
    }, [cart]);

    const showToast = useCallback((type, message) => {
        if (!message) return;
        setToast({ type, message, id: Date.now() });
    }, []);

    const applyCartResponse = useCallback(
        (payload, expectation = {}) => {
            const normalized = normalizeCartResponse(payload, cartStateRef.current);
            if (!normalized) return null;

            const nextCartId = normalized.id || normalized.cartId;
            const nextSessionId = normalized.sessionId;

            if (nextCartId && nextSessionId) {
                setCartState((prev) => {
                    if (prev.cartId === nextCartId && prev.sessionId === nextSessionId) return prev;
                    return { cartId: nextCartId, sessionId: nextSessionId };
                });
                persistCartSession(nextCartId, nextSessionId);
            }

            setCart(normalized);

            if (expectation?.itemId || expectation?.productId) {
                const matchedItem = normalized.items?.find((item) => {
                    if (expectation.itemId) return item.id === expectation.itemId;
                    return item.productId === expectation.productId;
                });

                const matchedQuantity = matchedItem?.quantity ?? matchedItem?.qty;
                if (matchedItem && expectation.quantity !== undefined && matchedQuantity !== expectation.quantity) {
                    showToast('warning', 'Quantity was adjusted based on current stock.');
                }
            }

            if (expectation?.intent === 'add' && expectation?.silent !== true) {
                showToast('success', 'Added to cart');
            }

            return normalized;
        },
        [cartState, showToast],
    );
    const ensureCartSession = useCallback(
        async ({ allowCreate = true, silent = false } = {}) => {
            if (cartRequestRef.current) return cartRequestRef.current;

            const request = (async () => {
                const storedCartId = cartStateRef.current.cartId;
                const storedSessionId = cartStateRef.current.sessionId;
                const existingCartId = cartRef.current?.id || storedCartId;
                const existingSessionId = cartRef.current?.sessionId || storedSessionId;

                try {
                    if (existingCartId && existingSessionId) {
                        const fetched = await fetchStoreCart(existingCartId, existingSessionId);
                        return applyCartResponse(fetched, silent ? { silent: true } : undefined);
                    }

                    if (!allowCreate) return null;

                    const created = await createStoreCart(existingSessionId);
                    return applyCartResponse(created, silent ? { silent: true } : undefined);
                } catch (error) {
                    if (!allowCreate) {
                        showToast('error', error?.message || 'Unable to start a cart session.');
                        return null;
                    }

                    console.error('Failed to sync cart', error);
                    clearCartSession();
                    try {
                        const created = await createStoreCart();
                        return applyCartResponse(created, silent ? { silent: true } : undefined);
                    } catch (creationError) {
                        showToast('error', creationError?.message || 'Unable to start a cart session.');
                        return null;
                    }
                }
            })()
                .finally(() => {
                    cartRequestRef.current = null;
                    setInitializing(false);
                });

            cartRequestRef.current = request;
            return request;
        },
        [applyCartResponse, showToast],
    );

    useEffect(() => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        setInitializing(true);
        ensureCartSession();
    }, [ensureCartSession]);

    const refreshCart = useCallback(async () => {
        if (!cartStateRef.current.cartId) return null;
        return ensureCartSession({ allowCreate: false, silent: true });
    }, [ensureCartSession]);

    const addToCart = useCallback(
        async (productId, quantity = 1) => {
            if (!productId) return null;
            setPendingProductId(productId);
            try {
                const ensuredCart = await ensureCartSession({ allowCreate: true, silent: true });
                const ensuredCartId = ensuredCart?.id || ensuredCart?.cartId;
                const ensuredSessionId = ensuredCart?.sessionId;

                if (!ensuredCartId || !ensuredSessionId) {
                    throw new Error('Unable to start a cart session. Please try again.');
                }

                const response = await addItemToCart(ensuredCartId, ensuredSessionId, productId, quantity);
                const updated = applyCartResponse(response, { productId, quantity, intent: 'add' });
                setIsCartOpen(true);
                return updated;
            } catch (error) {
                showToast('error', error?.message || 'Could not add to cart.');
                return null;
            } finally {
                setPendingProductId(null);
            }
        },
        [applyCartResponse, ensureCartSession, showToast],
    );

    const updateItemQuantity = useCallback(
        async (itemId, quantity) => {
            if (!itemId) return null;
            setPendingItemId(itemId);
            try {
                const response = await updateCartItem(cartStateRef.current.cartId, cartStateRef.current.sessionId, itemId, quantity);
                return applyCartResponse(response, { itemId, quantity });
            } catch (error) {
                showToast('error', error?.message || 'Unable to update quantity.');
                return null;
            } finally {
                setPendingItemId(null);
            }
        },
        [applyCartResponse, showToast],
    );

    const removeItem = useCallback(
        async (itemId) => {
            if (!itemId) return null;
            setPendingItemId(itemId);
            try {
                const response = await removeCartItem(cartStateRef.current.cartId, cartStateRef.current.sessionId, itemId);
                return applyCartResponse(response, { itemId, silent: true });
            } catch (error) {
                showToast('error', error?.message || 'Unable to remove item.');
                return null;
            } finally {
                setPendingItemId(null);
            }
        },
        [applyCartResponse, showToast],
    );

    const checkout = useCallback(
        async (payload) => {
            if (!cartStateRef.current.cartId || !cartStateRef.current.sessionId) {
                throw new Error('Cart session is not ready yet. Please try again.');
            }
            const response = await checkoutCartApi(cartStateRef.current.cartId, cartStateRef.current.sessionId, payload);
            if (response?.cart || response?.cartId) {
                applyCartResponse(response, { silent: true });
            }
            return response;
        },
        [applyCartResponse],
    );

    const createCheckoutSession = useCallback(
        async (payload) => {
            if (!cartStateRef.current.cartId || !cartStateRef.current.sessionId) {
                throw new Error('Cart session is not ready yet. Please try again.');
            }
            const response = await createCheckoutSessionApi(
                cartStateRef.current.cartId,
                cartStateRef.current.sessionId,
                payload,
            );
            if (response?.cart || response?.cartId) {
                applyCartResponse(response, { silent: true });
            }
            return response;
        },
        [applyCartResponse],
    );

    const closeCart = useCallback(() => setIsCartOpen(false), []);
    const openCart = useCallback(() => setIsCartOpen(true), []);
    const clearToast = useCallback(() => setToast(null), []);

    const value = useMemo(
        () => ({
            initializing,
            isCartOpen,
            cart,
            cartId: cartState.cartId || cart?.id || null,
            sessionId: cartState.sessionId || cart?.sessionId || null,
            toast,
            pendingProductId,
            pendingItemId,
            openCart,
            closeCart,
            refreshCart,
            addToCart,
            updateItemQuantity,
            removeItem,
            checkout,
            createCheckoutSession,
            clearToast,
        }),
        [
            addToCart,
            cart,
            cartState.cartId,
            cartState.sessionId,
            checkout,
            clearToast,
            closeCart,
            initializing,
            isCartOpen,
            openCart,
            pendingItemId,
            pendingProductId,
            refreshCart,
            removeItem,
            toast,
            updateItemQuantity,
            createCheckoutSession,
        ],
    );

    return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront() {
    return useContext(StorefrontContext);
}

export default StorefrontContext;
