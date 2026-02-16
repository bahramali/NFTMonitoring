import { authFetch, parseApiResponse } from './http.js';

import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const ADMIN_PRODUCTS_URL = `${API_BASE}/api/admin/store/products`;
const isDev = import.meta.env?.MODE === 'development';
const mockUpdatedAt = () => new Date().toISOString();

const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const normalizeProduct = (product) => {
    if (!product) return product;
    const id = product.id || product.productId || product._id || product.sku || null;
    return { ...product, id };
};

const normalizeProductsPayload = (payload) => {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.products)
            ? payload.products
            : [];

    return list.map(normalizeProduct);
};

const mockProducts = [
    {
        id: 'basil-001',
        name: 'Genovese Basil',
        sku: 'BASIL-GEN-001',
        description: 'Fragrant basil bundle harvested this week.',
        price: 59,
        currency: 'SEK',
        stock: 24,
        category: 'Basil',
        imageUrl: '',
        active: true,
        vatRate: 12,
        updatedAt: mockUpdatedAt(),
        variants: [
            {
                id: 'basil-001-50',
                weight: 50,
                price: 39,
                stock: 14,
                sku: 'BASIL-GEN-50',
                active: true,
            },
            {
                id: 'basil-001-70',
                weight: 70,
                price: 49,
                stock: 10,
                sku: 'BASIL-GEN-70',
                active: true,
            },
        ],
    },
    {
        id: 'pack-10l',
        name: 'Hydro pack 10L',
        sku: 'PACK-10L',
        description: 'Packaging set for leafy greens.',
        price: 129,
        currency: 'SEK',
        stock: 12,
        category: 'Packaging',
        imageUrl: '',
        active: false,
        vatRate: 25,
        updatedAt: mockUpdatedAt(),
        variants: [],
    },
];

const useMockFallback = (error) => {
    if (!isDev) return false;
    const status = error?.status ?? error?.response?.status;
    if (status && status !== 404 && status !== 501) return false;
    return true;
};

export async function listAdminProducts(token, { signal } = {}) {
    try {
        const res = await authFetch(
            `${ADMIN_PRODUCTS_URL}?includeVariants=true`,
            {
                method: 'GET',
                headers: authHeaders(token),
                signal,
            },
            { token },
        );
        const payload = await parseApiResponse(res, 'Failed to load products');
        return normalizeProductsPayload(payload);
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Using mock products fallback until backend endpoint is available.', error);
            return mockProducts;
        }
        throw error;
    }
}

export async function createProduct(payload, token) {
    try {
        const res = await authFetch(
            ADMIN_PRODUCTS_URL,
            {
                method: 'POST',
                headers: authHeaders(token),
                body: JSON.stringify(payload),
            },
            { token },
        );
        const data = await parseApiResponse(res, 'Failed to create product');
        return normalizeProduct(data);
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking product creation until backend endpoint is ready.', error);
            const mock = {
                ...payload,
                id: payload.id || globalThis.crypto?.randomUUID?.() || Date.now().toString(),
                updatedAt: mockUpdatedAt(),
            };
            mockProducts.unshift(mock);
            return mock;
        }
        throw error;
    }
}

export async function updateProduct(productId, payload, token) {
    if (!productId) throw new Error('Product ID is required');
    try {
        const res = await authFetch(
            `${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}`,
            {
                method: 'PUT',
                headers: authHeaders(token),
                body: JSON.stringify(payload),
            },
            { token },
        );
        const data = await parseApiResponse(res, 'Failed to update product');
        return normalizeProduct(data);
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking product update until backend endpoint is ready.', error);
            const index = mockProducts.findIndex((item) => item.id === productId);
            const existing = index >= 0 ? mockProducts[index] : { id: productId };
            const merged = { ...existing, ...payload, updatedAt: mockUpdatedAt() };
            if (index >= 0) {
                mockProducts[index] = merged;
            } else {
                mockProducts.unshift(merged);
            }
            return merged;
        }
        throw error;
    }
}

export async function toggleProductActive(productId, active, token) {
    if (!productId) throw new Error('Product ID is required');
    try {
        const res = await authFetch(
            `${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}/active`,
            {
                method: 'PATCH',
                headers: authHeaders(token),
                body: JSON.stringify({ active }),
            },
            { token },
        );
        const data = await parseApiResponse(res, 'Failed to update status');
        return normalizeProduct(data);
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking product active toggle until backend endpoint is ready.', error);
            const match = mockProducts.find((item) => item.id === productId);
            if (match) match.active = active;
            return match || { id: productId, active };
        }
        throw error;
    }
}

export async function updateProductStock(productId, stock, token) {
    if (!productId) throw new Error('Product ID is required');
    try {
        const res = await authFetch(
            `${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}/stock`,
            {
                method: 'PATCH',
                headers: authHeaders(token),
                body: JSON.stringify({ stock }),
            },
            { token },
        );
        const data = await parseApiResponse(res, 'Failed to update stock');
        return normalizeProduct(data);
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking product stock update until backend endpoint is ready.', error);
            const match = mockProducts.find((item) => item.id === productId);
            if (match) {
                match.stock = stock;
                match.updatedAt = mockUpdatedAt();
            }
            return match || { id: productId, stock };
        }
        throw error;
    }
}

export async function deleteProduct(productId, token) {
    if (!productId) throw new Error('Product ID is required');
    try {
        const res = await authFetch(
            `${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}`,
            {
                method: 'DELETE',
                headers: authHeaders(token),
            },
            { token },
        );
        return parseApiResponse(res, 'Failed to delete product');
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking product removal until backend endpoint is ready.', error);
            const index = mockProducts.findIndex((item) => item.id === productId);
            if (index >= 0) {
                mockProducts.splice(index, 1);
            }
            return { id: productId, deleted: true };
        }
        throw error;
    }
}

export async function createProductVariant(productId, payload, token) {
    if (!productId) throw new Error('Product ID is required');
    try {
        const res = await authFetch(
            `${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}/variants`,
            {
                method: 'POST',
                headers: authHeaders(token),
                body: JSON.stringify(payload),
            },
            { token },
        );
        return parseApiResponse(res, 'Failed to create variant');
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking variant creation until backend endpoint is ready.', error);
            const match = mockProducts.find((item) => item.id === productId);
            const created = {
                ...payload,
                id: payload.id || globalThis.crypto?.randomUUID?.() || Date.now().toString(),
            };
            if (match) {
                match.variants = Array.isArray(match.variants) ? match.variants : [];
                match.variants.push(created);
                match.updatedAt = mockUpdatedAt();
            }
            return created;
        }
        throw error;
    }
}

export async function updateProductVariant(productId, variantId, payload, token) {
    if (!productId) throw new Error('Product ID is required');
    if (!variantId) throw new Error('Variant ID is required');
    try {
        const res = await authFetch(
            `${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
            {
                method: 'PUT',
                headers: authHeaders(token),
                body: JSON.stringify(payload),
            },
            { token },
        );
        return parseApiResponse(res, 'Failed to update variant');
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking variant update until backend endpoint is ready.', error);
            const match = mockProducts.find((item) => item.id === productId);
            if (match) {
                match.variants = Array.isArray(match.variants) ? match.variants : [];
                const index = match.variants.findIndex((variant) => variant.id === variantId);
                const existing = index >= 0 ? match.variants[index] : { id: variantId };
                const merged = { ...existing, ...payload };
                if (index >= 0) {
                    match.variants[index] = merged;
                } else {
                    match.variants.push(merged);
                }
                match.updatedAt = mockUpdatedAt();
                return merged;
            }
            return { id: variantId, ...payload };
        }
        throw error;
    }
}

export async function deleteProductVariant(productId, variantId, token) {
    if (!productId) throw new Error('Product ID is required');
    if (!variantId) throw new Error('Variant ID is required');
    try {
        const res = await authFetch(
            `${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
            {
                method: 'DELETE',
                headers: authHeaders(token),
            },
            { token },
        );
        return parseApiResponse(res, 'Failed to delete variant');
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking variant removal until backend endpoint is ready.', error);
            const match = mockProducts.find((item) => item.id === productId);
            if (match && Array.isArray(match.variants)) {
                match.variants = match.variants.filter((variant) => variant.id !== variantId);
                match.updatedAt = mockUpdatedAt();
            }
            return { id: variantId, deleted: true };
        }
        throw error;
    }
}


export async function updateVariantTierPrices(variantId, payload, token) {
    if (!variantId) throw new Error('Variant ID is required');
    try {
        const res = await authFetch(
            `${API_BASE}/api/admin/variants/${encodeURIComponent(variantId)}/prices`,
            {
                method: 'PUT',
                headers: authHeaders(token),
                body: JSON.stringify(payload),
            },
            { token },
        );
        return parseApiResponse(res, 'Failed to update variant tier prices');
    } catch (error) {
        if (useMockFallback(error)) {
            console.warn('Mocking variant tier pricing update until backend endpoint is ready.', error);
            return { id: variantId, ...payload };
        }
        throw error;
    }
}
