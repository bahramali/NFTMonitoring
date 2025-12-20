import { parseApiResponse } from './http.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const STORE_PRODUCTS_URL = `${API_BASE}/api/store/products`;
const ADMIN_PRODUCTS_URL = `${API_BASE}/api/admin/products`;
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
        updatedAt: mockUpdatedAt(),
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
        updatedAt: mockUpdatedAt(),
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
        const res = await fetch(STORE_PRODUCTS_URL, {
            method: 'GET',
            headers: authHeaders(token),
            signal,
        });
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
        const res = await fetch(ADMIN_PRODUCTS_URL, {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify(payload),
        });
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
        const res = await fetch(`${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}`, {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify(payload),
        });
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
        const res = await fetch(`${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}/active`, {
            method: 'PATCH',
            headers: authHeaders(token),
            body: JSON.stringify({ active }),
        });
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
        const res = await fetch(`${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}/stock`, {
            method: 'PATCH',
            headers: authHeaders(token),
            body: JSON.stringify({ stock }),
        });
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
        const res = await fetch(`${ADMIN_PRODUCTS_URL}/${encodeURIComponent(productId)}`, {
            method: 'DELETE',
            headers: authHeaders(token),
        });
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
