import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    addItemToCart,
    createStoreCart,
    fetchCurrentStoreCart,
    fetchStoreCart,
    normalizeCartResponse,
    removeCartItem,
    updateCartItem,
} from '../api/store.js';
import {
    STOREFRONT_CART_RESET_EVENT,
    STOREFRONT_CART_STORAGE_KEY,
    clearPersistedStorefrontSession,
} from '../utils/storefrontSession.js';
import { useAuth } from './AuthContext.jsx';

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
    startNewCart: async () => {},
    clearCart: () => {},
    notify: () => {},
    clearToast: () => {},
});

const readStoredCartSession = () => {
    if (typeof window === 'undefined') return defaultState;
    const raw = window.localStorage.getItem(STOREFRONT_CART_STORAGE_KEY);
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
    window.localStorage.setItem(STOREFRONT_CART_STORAGE_KEY, JSON.stringify({ cartId, sessionId }));
};

const clearCartSession = () => {
    clearPersistedStorefrontSession();
};

export function StorefrontProvider({ children }) {
    const { isAuthenticated, token } = useAuth();
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
    const authStateRef = useRef({ isAuthenticated, token });

    useEffect(() => {
        cartStateRef.current = cartState;
    }, [cartState]);

    useEffect(() => {
        cartRef.current = cart;
    }, [cart]);

    const resetCartState = useCallback(() => {
        clearCartSession();
        cartStateRef.current = defaultState;
        cartRef.current = null;
        cartRequestRef.current = null;
        setCartState(defaultState);
        setCart(null);
        setPendingItemId(null);
        setPendingProductId(null);
        setIsCartOpen(false);
    }, []);

    const runLogoutRegressionGuard = useCallback(async (previousCartId) => {
        try {
            const cartPayload = await fetchCurrentStoreCart();
            const anonymousCart = normalizeCartResponse(cartPayload, defaultState);
            const nextCartId = anonymousCart?.id || anonymousCart?.cartId || null;
            const hasNoItems = (anonymousCart?.items?.length ?? 0) === 0;
            const hasNewCartId = Boolean(nextCartId && nextCartId !== previousCartId);

            if (!hasNoItems && !hasNewCartId) {
                console.warn('Logout cart reset guard detected stale anonymous cart state.', {
                    previousCartId,
                    nextCartId,
                });
            }
        } catch (error) {
            console.warn('Logout cart reset guard request failed.', error);
        }
    }, []);

    const showToast = useCallback((type, message) => {
        if (!message) return;
        setToast({ type, message, id: Date.now() });
    }, []);

    const isCartClosedError = useCallback((error) => {
        if (error?.status !== 409) return false;
        const message = `${error?.message || ''}`.toLowerCase();
        const code = error?.code || error?.payload?.code || error?.payload?.error?.code;
        return code === 'CART_CLOSED' || message.includes('no longer open');
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

            if (expectation?.itemId || expectation?.productId || expectation?.variantId) {
                const matchedItem = normalized.items?.find((item) => {
                    if (expectation.itemId) return item.id === expectation.itemId;
                    if (expectation.variantId) return item.variantId === expectation.variantId || item.variant?.id === expectation.variantId;
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
                        if (fetched?.status && fetched.status !== 'OPEN') {
                            resetCartState();

                            const created = await createStoreCart();
                            if (!silent) {
                                showToast('info', 'Previous cart was checked out. Started a new cart.');
                            }
                            return applyCartResponse(created, silent ? { silent: true } : undefined);
                        }
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
                    resetCartState();
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
        [applyCartResponse, resetCartState, showToast],
    );

    const recoverClosedCart = useCallback(async () => {
        resetCartState();
        await ensureCartSession({ allowCreate: true, silent: true });
        showToast('info', 'Cart expired. Please retry.');
    }, [ensureCartSession, resetCartState, showToast]);

    useEffect(() => {
        const handleStorefrontSessionReset = () => {
            const previousCartId = cartRef.current?.id || cartStateRef.current?.cartId || null;
            resetCartState();
            // Regression test steps:
            // 1) Sign in as a VIP user and add an item to cart.
            // 2) Log out and confirm this reset handler runs.
            // 3) Verify GET /api/store/cart returns either a new cartId or an empty anonymous cart.
            // 4) Add the same product again and verify regular (non-VIP) pricing is shown.
            runLogoutRegressionGuard(previousCartId);
        };

        if (typeof window === 'undefined') return undefined;
        window.addEventListener(STOREFRONT_CART_RESET_EVENT, handleStorefrontSessionReset);
        return () => {
            window.removeEventListener(STOREFRONT_CART_RESET_EVENT, handleStorefrontSessionReset);
        };
    }, [resetCartState, runLogoutRegressionGuard]);

    useEffect(() => {
        if (didInitRef.current) return;
        didInitRef.current = true;
        setInitializing(true);
        ensureCartSession();
    }, [ensureCartSession]);

    useEffect(() => {
        if (!didInitRef.current) {
            authStateRef.current = { isAuthenticated, token };
            return;
        }

        const previousAuthState = authStateRef.current;
        authStateRef.current = { isAuthenticated, token };
        if (isAuthenticated && token && (!previousAuthState.isAuthenticated || previousAuthState.token !== token)) {
            ensureCartSession({ allowCreate: true, silent: true });
        }
    }, [ensureCartSession, isAuthenticated, token]);

    const refreshCart = useCallback(async () => {
        if (!cartStateRef.current.cartId) return null;
        return ensureCartSession({ allowCreate: false, silent: true });
    }, [ensureCartSession]);

    const addToCart = useCallback(
        async (itemId, quantity = 1, productId = null) => {
            if (!itemId) return null;
            setPendingProductId(productId || itemId);
            try {
                const ensuredCart = await ensureCartSession({ allowCreate: true, silent: true });
                const ensuredCartId = ensuredCart?.id || ensuredCart?.cartId;
                const ensuredSessionId = ensuredCart?.sessionId;

                if (!ensuredCartId || !ensuredSessionId) {
                    throw new Error('Unable to start a cart session. Please try again.');
                }

                const response = await addItemToCart(ensuredCartId, ensuredSessionId, itemId, quantity);
                const updated = applyCartResponse(response, { itemId, quantity, intent: 'add' });
                setIsCartOpen(true);
                return updated;
            } catch (error) {
                if (isCartClosedError(error)) {
                    await recoverClosedCart();
                } else if (error?.status === 409) {
                    const message = error?.message || '';
                    const fallback = message.toLowerCase().includes('not enough')
                        ? 'Not enough stock'
                        : 'Out of stock';
                    showToast('error', message || fallback);
                } else {
                    showToast('error', error?.message || 'Could not add to cart.');
                }
                return null;
            } finally {
                setPendingProductId(null);
            }
        },
        [applyCartResponse, ensureCartSession, isCartClosedError, recoverClosedCart, showToast],
    );

    const updateItemQuantity = useCallback(
        async (itemId, quantity) => {
            if (!itemId) return null;
            if (cartRef.current?.status && cartRef.current.status !== 'OPEN') return null;
            setPendingItemId(itemId);
            try {
                const response = await updateCartItem(cartStateRef.current.cartId, cartStateRef.current.sessionId, itemId, quantity);
                return applyCartResponse(response, { itemId, quantity });
            } catch (error) {
                if (isCartClosedError(error)) {
                    await recoverClosedCart();
                } else {
                    showToast('error', error?.message || 'Unable to update quantity.');
                }
                return null;
            } finally {
                setPendingItemId(null);
            }
        },
        [applyCartResponse, isCartClosedError, recoverClosedCart, showToast],
    );

    const removeItem = useCallback(
        async (itemId) => {
            if (!itemId) return null;
            if (cartRef.current?.status && cartRef.current.status !== 'OPEN') return null;
            setPendingItemId(itemId);
            try {
                const response = await removeCartItem(cartStateRef.current.cartId, cartStateRef.current.sessionId, itemId);
                return applyCartResponse(response, { itemId, silent: true });
            } catch (error) {
                if (isCartClosedError(error)) {
                    await recoverClosedCart();
                } else {
                    showToast('error', error?.message || 'Unable to remove item.');
                }
                return null;
            } finally {
                setPendingItemId(null);
            }
        },
        [applyCartResponse, isCartClosedError, recoverClosedCart, showToast],
    );

    const startNewCart = useCallback(
        async () => {
            resetCartState();

            const created = await ensureCartSession({ allowCreate: true, silent: true });
            showToast('info', 'Started a new cart.');
            return created;
        },
        [ensureCartSession, resetCartState, showToast],
    );

    const closeCart = useCallback(() => setIsCartOpen(false), []);
    const openCart = useCallback(() => setIsCartOpen(true), []);
    const clearCart = useCallback(() => {
        resetCartState();
    }, [resetCartState]);
    const clearToast = useCallback(() => setToast(null), []);
    const notify = useCallback((type, message) => showToast(type, message), [showToast]);

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
            startNewCart,
            clearCart,
            notify,
            clearToast,
        }),
        [
            addToCart,
            cart,
            cartState.cartId,
            cartState.sessionId,
            clearToast,
            clearCart,
            closeCart,
            initializing,
            isCartOpen,
            openCart,
            pendingItemId,
            pendingProductId,
            refreshCart,
            removeItem,
            startNewCart,
            toast,
            updateItemQuantity,
            notify,
        ],
    );

    return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront() {
    return useContext(StorefrontContext);
}

export default StorefrontContext;
