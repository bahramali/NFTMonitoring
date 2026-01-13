import { parseApiResponse } from './http.js';
import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();

export async function fetchCheckoutSession(sessionId, { signal } = {}) {
    if (!sessionId) throw new Error('Session ID is required');
    const res = await fetch(`${API_BASE}/api/payments/checkout-session/${encodeURIComponent(sessionId)}`, { signal });
    return parseApiResponse(res, 'Failed to load checkout session');
}

export async function fetchOrderBySession(sessionId, { signal } = {}) {
    if (!sessionId) throw new Error('Session ID is required');
    const res = await fetch(`${API_BASE}/api/orders/by-session/${encodeURIComponent(sessionId)}`, { signal });
    return parseApiResponse(res, 'Failed to load order');
}
