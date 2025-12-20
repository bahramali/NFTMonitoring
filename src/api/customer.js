import { parseApiResponse } from './http.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const PROFILE_URL = `${API_BASE}/api/me`;
const MY_DEVICES_URL = `${API_BASE}/api/my/devices`;
const MY_ORDERS_URL = `${API_BASE}/api/store/orders/my`;

const unauthorizedStatuses = new Set([401, 403]);
const unsupportedStatuses = new Set([404, 501]);

const authHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
});

const handleUnauthorized = (error, onUnauthorized) => {
    if (unauthorizedStatuses.has(error?.status)) {
        onUnauthorized?.(error);
        return true;
    }
    return false;
};

const markUnsupported = (error) => {
    if (unsupportedStatuses.has(error?.status)) {
        const unsupported = new Error(error?.message || 'Endpoint is not available');
        unsupported.status = error?.status;
        unsupported.isUnsupported = true;
        throw unsupported;
    }
};

export async function fetchCustomerProfile(token, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to load the profile');
    const res = await fetch(PROFILE_URL, { headers: authHeaders(token), signal });

    try {
        return await parseApiResponse(res, 'Failed to load profile');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        throw error;
    }
}

export async function fetchMyDevices(token, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to load devices');
    const res = await fetch(MY_DEVICES_URL, { headers: authHeaders(token), signal });

    try {
        return await parseApiResponse(res, 'Failed to load devices');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        throw error;
    }
}

export async function fetchDeviceDetails(token, deviceId, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to load device details');
    if (!deviceId) throw new Error('Device ID is required');

    const url = `${MY_DEVICES_URL}/${encodeURIComponent(deviceId)}`;
    const res = await fetch(url, { headers: authHeaders(token), signal });

    try {
        return await parseApiResponse(res, 'Failed to load device details');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        throw error;
    }
}

export async function fetchMyOrders(token, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to load orders');
    const res = await fetch(MY_ORDERS_URL, { headers: authHeaders(token), signal });

    try {
        return await parseApiResponse(res, 'Failed to load your orders');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        markUnsupported(error);
        throw error;
    }
}

export async function fetchOrderDetail(token, orderId, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to load an order');
    if (!orderId) throw new Error('Order ID is required');

    const url = `${API_BASE}/api/store/orders/${encodeURIComponent(orderId)}`;
    const res = await fetch(url, { headers: authHeaders(token), signal });

    try {
        return await parseApiResponse(res, 'Failed to load order details');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        markUnsupported(error);
        throw error;
    }
}
