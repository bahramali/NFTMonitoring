import { authFetch, buildAuthHeaders, parseApiResponse, parseApiResponseWithMeta } from './http.js';

import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const STORE_BASE = `${API_BASE}/api/store`;


const normalizeVatRate = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed <= 1 ? parsed * 100 : parsed;
};

const resolveItemVatRate = (item = {}) => {
    const rate = normalizeVatRate(
        item?.vatRate
        ?? item?.vat_rate
        ?? item?.momsRate
        ?? item?.taxRate
        ?? item?.tax_rate,
    );
    return rate;
};

const estimateVatFromGrossLine = (grossLineAmount, vatRatePercent) => {
    const gross = Number(grossLineAmount);
    const rate = Number(vatRatePercent);
    if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
    const factor = rate / 100;
    return gross - (gross / (1 + factor));
};

const buildCartHeaders = (cartId, sessionId) => {
    const headers = {};
    if (cartId) headers['X-Cart-Id'] = cartId;
    if (sessionId) headers['X-Session-Id'] = sessionId;
    return headers;
};

export async function listStoreProducts({ signal, token } = {}) {
    const resolvedToken = token ?? null;
    const res = await authFetch(
        `${STORE_BASE}/products`,
        {
            signal,
            headers: resolvedToken ? buildAuthHeaders(resolvedToken) : undefined,
        },
        { token: resolvedToken },
    );
    return parseApiResponse(res, 'Failed to load products');
}

export async function listStoreBanners({ signal } = {}) {
    const res = await authFetch(`${STORE_BASE}/banners`, {
        method: 'GET',
        signal,
    });

    return parseApiResponse(res, 'Failed to load banners');
}

export async function fetchStoreConfig({ signal } = {}) {
    const res = await authFetch(`${STORE_BASE}/config`, {
        method: 'GET',
        signal,
    });

    return parseApiResponse(res, 'Failed to load store config');
}

export async function fetchStoreProduct(productId, { signal, token } = {}) {
    if (!productId) throw new Error('Product ID is required');
    const requestUrl = `${STORE_BASE}/products/${encodeURIComponent(productId)}`;
    const resolvedToken = token ?? null;
    const res = await authFetch(
        requestUrl,
        {
            signal,
            headers: resolvedToken ? buildAuthHeaders(resolvedToken) : undefined,
        },
        { token: resolvedToken },
    );
    return parseApiResponse(res, 'Failed to load product');
}

export async function createStoreCart(sessionId, { signal } = {}) {
    const body = sessionId ? JSON.stringify({ sessionId }) : null;
    const res = await authFetch(`${STORE_BASE}/cart`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...buildCartHeaders(null, sessionId),
        },
        body,
        signal,
    });

    return parseApiResponse(res, 'Failed to create cart');
}

export async function fetchCurrentStoreCart({ signal } = {}) {
    const res = await authFetch(`${STORE_BASE}/cart`, {
        method: 'GET',
        credentials: 'include',
        signal,
    });

    return parseApiResponse(res, 'Failed to fetch current cart');
}

export async function fetchStoreCart(cartId, sessionId, { signal } = {}) {
    if (!cartId) throw new Error('Cart ID is required');
    const res = await authFetch(`${STORE_BASE}/cart/${encodeURIComponent(cartId)}`, {
        credentials: 'include',
        headers: buildCartHeaders(cartId, sessionId),
        signal,
    });

    return parseApiResponse(res, 'Failed to fetch cart');
}

export async function addItemToCart(cartId, sessionId, itemId, quantity = 1, { signal } = {}) {
    if (!itemId) throw new Error('Item ID is required');

    const res = await authFetch(`${STORE_BASE}/cart/${encodeURIComponent(cartId)}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...buildCartHeaders(cartId, sessionId),
        },
        body: JSON.stringify({ variantId: itemId, quantity }),
        signal,
    });

    return parseApiResponse(res, 'Failed to add item to cart');
}

export async function updateCartItem(cartId, sessionId, itemId, quantity, { signal } = {}) {
    if (!itemId) throw new Error('Line item ID is required');

    const res = await authFetch(`${STORE_BASE}/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        credentials: 'include',
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

    const res = await authFetch(`${STORE_BASE}/cart/${encodeURIComponent(cartId)}/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: buildCartHeaders(cartId, sessionId),
        signal,
    });

    return parseApiResponse(res, 'Failed to remove item from cart');
}

export async function checkoutCart(cartId, payload = {}, { signal } = {}) {
    if (!cartId) throw new Error('Cart ID is required');
    const {
        email,
        userId,
        shippingAddress,
        sessionId,
        customerType,
        company,
        couponCode,
        paymentMode,
    } = payload ?? {};
    const res = await fetch(`${STORE_BASE}/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...buildCartHeaders(cartId, sessionId),
        },
        body: JSON.stringify({
            cartId,
            email,
            userId,
            shippingAddress,
            customerType,
            company,
            couponCode,
            paymentMode,
        }),
        signal,
    });

    return parseApiResponse(res, 'Checkout failed');
}

export async function createCheckoutSession(cartId, payload = {}, { signal } = {}) {
    if (!cartId) throw new Error('Cart ID is required');
    const checkoutPayload = await checkoutCart(cartId, payload, { signal });
    const orderId = checkoutPayload?.orderId ?? checkoutPayload?.order?.id ?? checkoutPayload?.id;
    if (!orderId) {
        throw new Error('Checkout did not return an order ID.');
    }
    const paymentUrl =
        checkoutPayload?.paymentUrl
        ?? checkoutPayload?.payment_url
        ?? checkoutPayload?.redirectUrl
        ?? checkoutPayload?.url
        ?? checkoutPayload?.checkout?.paymentUrl
        ?? null;
    return {
        orderId,
        paymentUrl,
        checkout: checkoutPayload,
    };
}

export async function fetchCheckoutQuote(token, { cartId, couponCode, sessionId } = {}, { signal } = {}) {
    if (!cartId) throw new Error('Cart ID is required');
    const res = await authFetch(
        `${STORE_BASE}/checkout/quote`,
        {
            method: 'POST',
            headers: {
                ...buildAuthHeaders(token),
                ...buildCartHeaders(cartId, sessionId),
            },
            body: JSON.stringify({
                cartId,
                couponCode,
            }),
            signal,
        },
        { token },
    );

    return parseApiResponse(res, 'Failed to quote checkout total');
}

export async function applyStoreCoupon(token, { cartId, couponCode, sessionId } = {}, { signal } = {}) {
    if (!cartId) throw new Error('Cart ID is required');
    if (!couponCode) throw new Error('Coupon code is required');

    const res = await authFetch(
        `${STORE_BASE}/cart/apply-coupon`,
        {
            method: 'POST',
            headers: {
                ...buildAuthHeaders(token),
                ...buildCartHeaders(cartId, sessionId),
            },
            body: JSON.stringify({
                cartId,
                code: couponCode,
            }),
            signal,
        },
        { token },
    );

    return parseApiResponse(res, 'Failed to apply coupon');
}

export async function createStripeCheckoutSession(
    token,
    { cartId, email, shippingAddress, couponCode, sessionId, customerType, company, paymentMode } = {},
    { signal } = {},
) {
    if (!cartId) throw new Error('Cart ID is required');
    const res = await authFetch(
        `${STORE_BASE}/checkout/stripe/session`,
        {
            method: 'POST',
            headers: {
                ...buildAuthHeaders(token),
                ...buildCartHeaders(cartId, sessionId),
            },
            body: JSON.stringify({
                cartId,
                email,
                shippingAddress,
                couponCode,
                customerType,
                company,
                paymentMode,
            }),
            signal,
        },
        { token },
    );

    return parseApiResponse(res, 'Failed to start Stripe Checkout');
}

export async function fetchOrderStatus(orderId, { signal } = {}) {
    if (!orderId) throw new Error('Order ID is required');
    const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}`, { signal });
    return parseApiResponseWithMeta(res, 'Failed to load order status');
}

export async function fetchStoreOrderBySession(sessionId, { signal } = {}) {
    if (!sessionId) throw new Error('Session ID is required');
    const encodedSessionId = encodeURIComponent(sessionId);
    const res = await fetch(`${API_BASE}/api/store/orders/by-session/${encodedSessionId}`, { signal });
    return parseApiResponseWithMeta(res, 'Failed to load order by session');
}

export function normalizeCartResponse(payload, fallback = {}) {
    if (!payload) return null;
    const cart = payload.cart ?? payload;
    const cartId = cart.id ?? cart.cartId ?? payload.cartId ?? fallback.cartId ?? null;
    const sessionId = cart.sessionId ?? payload.sessionId ?? fallback.sessionId ?? null;
    const normalizedCart = { ...cart, id: cartId, cartId, sessionId };
    const totals = normalizedCart.totals ?? {};
    const currency = totals.currency || normalizedCart.currency || payload?.currency || 'SEK';
    const items = Array.isArray(normalizedCart.items) ? normalizedCart.items : [];

    const safeNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const toCurrencyAmount = (value, centsValue) => {
        if (value != null) return safeNumber(value);
        if (centsValue != null) return safeNumber(centsValue) / 100;
        return undefined;
    };

    const mappedItems = items.map((item) => {
        const quantity = item?.quantity ?? item?.qty ?? 1;
        const unitPrice = toCurrencyAmount(item?.price ?? item?.unitPrice, item?.unitPriceCents);
        const discountedUnitPrice = toCurrencyAmount(item?.discountedUnitPrice, item?.discountedUnitPriceCents);
        const lineTotal = toCurrencyAmount(item?.total ?? item?.lineTotal, item?.lineTotalCents);
        const discountedLineTotal = toCurrencyAmount(item?.discountedLineTotal, item?.discountedLineTotalCents);
        const lineDiscount = toCurrencyAmount(item?.lineDiscount, item?.lineDiscountCents);

        return {
            ...item,
            quantity,
            unitPrice,
            discountedUnitPrice,
            lineTotal,
            discountedLineTotal,
            lineDiscount,
            vatRate: resolveItemVatRate(item),
        };
    });

    normalizedCart.items = mappedItems;

    const subtotalComputed = mappedItems.reduce((sum, item) => {
        const quantity = safeNumber(item?.quantity ?? item?.qty ?? 1);
        const unitPrice = safeNumber(item?.discountedUnitPrice ?? item?.unitPrice ?? item?.price ?? item?.amount ?? 0);
        const lineTotal = item?.discountedLineTotal ?? item?.lineTotal ?? item?.total;
        const lineValue = lineTotal != null ? safeNumber(lineTotal) : unitPrice * quantity;
        return sum + lineValue;
    }, 0);

    const subtotalFromTotals = toCurrencyAmount(totals.subtotal, totals.subtotalCents);
    const discountFromTotals = toCurrencyAmount(totals.discount, totals.discountCents);
    const shippingFromTotals = toCurrencyAmount(totals.shipping, totals.shippingCents);
    const taxFromTotals = toCurrencyAmount(totals.tax, totals.taxCents);
    const totalFromTotals = toCurrencyAmount(totals.total, totals.totalCents);

    const subtotalFromCart = toCurrencyAmount(normalizedCart.subtotal, normalizedCart.subtotalCents);
    const discountFromCart = toCurrencyAmount(normalizedCart.discount, normalizedCart.discountCents);
    const totalFromCart = toCurrencyAmount(normalizedCart.total, normalizedCart.totalCents);
    const shippingFromCart = toCurrencyAmount(normalizedCart.shipping, normalizedCart.shippingCents);
    const taxFromCart = toCurrencyAmount(normalizedCart.tax, normalizedCart.taxCents);

    const subtotal = subtotalFromTotals ?? subtotalFromCart ?? subtotalComputed;
    const discount = discountFromTotals ?? discountFromCart ?? 0;
    const shipping = shippingFromTotals ?? shippingFromCart ?? 0;
    const taxFromItems = mappedItems.reduce((sum, item) => {
        const lineGross = item?.discountedLineTotal ?? item?.lineTotal;
        if (lineGross !== undefined && lineGross !== null) {
            return sum + estimateVatFromGrossLine(lineGross, item?.vatRate);
        }

        const quantity = safeNumber(item?.quantity ?? item?.qty ?? 1);
        const unitGross = safeNumber(item?.discountedUnitPrice ?? item?.unitPrice ?? item?.price ?? 0);
        return sum + estimateVatFromGrossLine(unitGross * quantity, item?.vatRate);
    }, 0);

    const tax = taxFromTotals ?? taxFromCart ?? taxFromItems ?? 0;
    const totalComputed = subtotal + shipping + tax - discount;
    const total = totalFromTotals ?? totalFromCart ?? totalComputed;

    normalizedCart.totals = {
        ...totals,
        currency,
        subtotal,
        discount,
        shipping,
        tax,
        total,
    };

    return normalizedCart;
}
