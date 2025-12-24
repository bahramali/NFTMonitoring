import { parseApiResponse } from './http.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const STORE_BASE = `${API_BASE}/api/store`;

const buildCartHeaders = (cartId, sessionId) => {
    const headers = {};
    if (cartId) headers['X-Cart-Id'] = cartId;
    if (sessionId) headers['X-Session-Id'] = sessionId;
    return headers;
};

export async function listStoreProducts({ signal } = {}) {
    const res = await fetch(`${STORE_BASE}/products`, { signal });
    return parseApiResponse(res, 'Failed to load products');
}

export async function fetchStoreProduct(productId, { signal } = {}) {
    if (!productId) throw new Error('Product ID is required');
    const res = await fetch(`${STORE_BASE}/products/${encodeURIComponent(productId)}`, { signal });
    return parseApiResponse(res, 'Failed to load product');
}

export async function createStoreCart(sessionId, { signal } = {}) {
    const body = sessionId ? JSON.stringify({ sessionId }) : null;
    const res = await fetch(`${STORE_BASE}/cart`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...buildCartHeaders(null, sessionId),
        },
        body,
        signal,
    });

    return parseApiResponse(res, 'Failed to create cart');
}

export async function fetchStoreCart(cartId, sessionId, { signal } = {}) {
    if (!cartId) throw new Error('Cart ID is required');
    const res = await fetch(`${STORE_BASE}/cart/${encodeURIComponent(cartId)}`, {
        headers: buildCartHeaders(cartId, sessionId),
        signal,
    });

    return parseApiResponse(res, 'Failed to fetch cart');
}

export async function addItemToCart(cartId, sessionId, productId, quantity = 1, { signal } = {}) {
    if (!productId) throw new Error('Product ID is required');

    const res = await fetch(`${STORE_BASE}/cart/${encodeURIComponent(cartId)}/items`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...buildCartHeaders(cartId, sessionId),
        },
        body: JSON.stringify({ productId, quantity }),
        signal,
    });

    return parseApiResponse(res, 'Failed to add item to cart');
}

export async function updateCartItem(cartId, sessionId, itemId, quantity, { signal } = {}) {
    if (!itemId) throw new Error('Line item ID is required');

    const res = await fetch(`${STORE_BASE}/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...buildCartHeaders(cartId, sessionId),
        },
        body: JSON.stringify({ quantity }),
        signal,
    });

    return parseApiResponse(res, 'Failed to update cart item');
}

export async function removeCartItem(cartId, sessionId, itemId, { signal } = {}) {
    if (!itemId) throw new Error('Line item ID is required');

    const res = await fetch(`${STORE_BASE}/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: buildCartHeaders(cartId, sessionId),
        signal,
    });

    return parseApiResponse(res, 'Failed to remove item from cart');
}

export async function checkoutCart(cartId, sessionId, payload = {}, { signal } = {}) {
    const res = await fetch(`${STORE_BASE}/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...buildCartHeaders(cartId, sessionId),
        },
        body: JSON.stringify({
            ...payload,
            cartId,
            sessionId,
        }),
        signal,
    });

    return parseApiResponse(res, 'Checkout failed');
}

export async function createCheckoutSession(cartId, sessionId, payload = {}, { signal } = {}) {
    const res = await fetch(`${API_BASE}/api/checkout/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...buildCartHeaders(cartId, sessionId),
        },
        body: JSON.stringify({
            ...payload,
            cartId,
            sessionId,
        }),
        signal,
    });

    return parseApiResponse(res, 'Failed to start checkout');
}

export async function fetchOrderStatus(orderId, { signal } = {}) {
    if (!orderId) throw new Error('Order ID is required');
    const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}`, { signal });
    return parseApiResponse(res, 'Failed to load order status');
}

export function normalizeCartResponse(payload, fallback = {}) {
    if (!payload) return null;
    const cart = payload.cart ?? payload;
    const cartId = cart.id ?? cart.cartId ?? payload.cartId ?? fallback.cartId ?? null;
    const sessionId = cart.sessionId ?? payload.sessionId ?? fallback.sessionId ?? null;
    const normalizedCart = { ...cart, id: cartId, cartId, sessionId };
    const totals = normalizedCart.totals ?? {};
    const currency = totals.currency || normalizedCart.currency || 'SEK';
    const items = Array.isArray(normalizedCart.items) ? normalizedCart.items : [];

    const safeNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const subtotalComputed = items.reduce((sum, item) => {
        const quantity = safeNumber(item?.quantity ?? 1);
        const unitPrice = safeNumber(item?.price ?? item?.unitPrice ?? item?.amount ?? 0);
        const lineTotal = item?.total ?? item?.lineTotal;
        const lineValue = lineTotal != null ? safeNumber(lineTotal) : unitPrice * quantity;
        return sum + lineValue;
    }, 0);

    const shipping = totals.shipping != null ? safeNumber(totals.shipping) : 0;
    const totalComputed = subtotalComputed + shipping;

    const subtotalNeedsFallback = totals.subtotal == null || (totals.subtotal === 0 && subtotalComputed > 0);
    const totalNeedsFallback = totals.total == null || (totals.total === 0 && totalComputed > 0);

    if (subtotalNeedsFallback || totalNeedsFallback) {
        normalizedCart.totals = {
            ...totals,
            currency,
            subtotal: subtotalNeedsFallback ? subtotalComputed : totals.subtotal,
            total: totalNeedsFallback ? totalComputed : totals.total,
        };
    }

    return normalizedCart;
}
