import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    addItemToCart,
    checkoutCart as checkoutCartApi,
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

    const showToast = useCallback((type, message) => {
        if (!message) return;
        setToast({ type, message, id: Date.now() });
    }, []);

    const applyCartResponse = useCallback(
        (payload, expectation = {}) => {
            const normalized = normalizeCartResponse(payload, cartState);
            if (!normalized) return null;

            const nextCartId = normalized.id || normalized.cartId;
            const nextSessionId = normalized.sessionId;
            if (nextCartId && nextSessionId) {
                setCartState({ cartId: nextCartId, sessionId: nextSessionId });
                persistCartSession(nextCartId, nextSessionId);
            }

            setCart(normalized);

            if (expectation?.itemId || expectation?.productId) {
                const matchedItem = normalized.items?.find((item) => {
                    if (expectation.itemId) return item.id === expectation.itemId;
                    return item.productId === expectation.productId;
                });

                if (matchedItem && expectation.quantity !== undefined && matchedItem.quantity !== expectation.quantity) {
                    showToast('warning', 'Quantity was adjusted based on current stock.');
                }
            }

            if (expectation?.intent === 'add' && expectation?.silent !== true) {
                showToast('success', 'Added to cart.');
            }

            return normalized;
        },
        [cartState, showToast],
    );

    const bootstrapCart = useCallback(async () => {
        setInitializing(true);
        try {
            if (!cartState.cartId || !cartState.sessionId) {
                const created = await createStoreCart(cartState.sessionId);
                applyCartResponse(created);
                return;
            }

            const fetched = await fetchStoreCart(cartState.cartId, cartState.sessionId);
            applyCartResponse(fetched);
        } catch (error) {
            console.error('Failed to sync cart', error);
            clearCartSession();
            try {
                const created = await createStoreCart();
                applyCartResponse(created);
            } catch (creationError) {
                showToast('error', creationError?.message || 'Unable to start a cart session.');
            }
        } finally {
            setInitializing(false);
        }
    }, [applyCartResponse, cartState.cartId, cartState.sessionId, showToast]);

    useEffect(() => {
        bootstrapCart();
    }, [bootstrapCart]);

    const refreshCart = useCallback(async () => {
        if (!cartState.cartId) return null;
        try {
            const fetched = await fetchStoreCart(cartState.cartId, cartState.sessionId);
            return applyCartResponse(fetched, { silent: true });
        } catch (error) {
            showToast('error', error?.message || 'Unable to refresh cart.');
            return null;
        }
    }, [applyCartResponse, cartState.cartId, cartState.sessionId, showToast]);

    const addToCart = useCallback(
        async (productId, quantity = 1) => {
            if (!productId) return null;
            setPendingProductId(productId);
            try {
                const ensuredCartId = cartState.cartId || cart?.id;
                const ensuredSessionId = cartState.sessionId || cart?.sessionId;
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
        [applyCartResponse, cart?.id, cart?.sessionId, cartState.cartId, cartState.sessionId, showToast],
    );

    const updateItemQuantity = useCallback(
        async (itemId, quantity) => {
            if (!itemId) return null;
            setPendingItemId(itemId);
            try {
                const response = await updateCartItem(cartState.cartId, cartState.sessionId, itemId, quantity);
                return applyCartResponse(response, { itemId, quantity });
            } catch (error) {
                showToast('error', error?.message || 'Unable to update quantity.');
                return null;
            } finally {
                setPendingItemId(null);
            }
        },
        [applyCartResponse, cartState.cartId, cartState.sessionId, showToast],
    );

    const removeItem = useCallback(
        async (itemId) => {
            if (!itemId) return null;
            setPendingItemId(itemId);
            try {
                const response = await removeCartItem(cartState.cartId, cartState.sessionId, itemId);
                return applyCartResponse(response, { itemId, silent: true });
            } catch (error) {
                showToast('error', error?.message || 'Unable to remove item.');
                return null;
            } finally {
                setPendingItemId(null);
            }
        },
        [applyCartResponse, cartState.cartId, cartState.sessionId, showToast],
    );

    const checkout = useCallback(
        async (payload) => {
            if (!cartState.cartId || !cartState.sessionId) {
                throw new Error('Cart session is not ready yet. Please try again.');
            }
            const response = await checkoutCartApi(cartState.cartId, cartState.sessionId, payload);
            if (response?.cart || response?.cartId) {
                applyCartResponse(response, { silent: true });
            }
            return response;
        },
        [applyCartResponse, cartState.cartId, cartState.sessionId],
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
        ],
    );

    return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront() {
    return useContext(StorefrontContext);
}

export default StorefrontContext;
