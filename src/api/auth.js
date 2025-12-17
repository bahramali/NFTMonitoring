import { parseApiResponse } from './http.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const AUTH_BASE = `${API_BASE}/api/auth`;

export async function fetchInviteDetails(token) {
    if (!token) {
        throw new Error('Invite token is required.');
    }

    const res = await fetch(`${AUTH_BASE}/accept-invite/${encodeURIComponent(token)}`);
    return parseApiResponse(res, 'Failed to validate invite');
}

export async function completeInvite(token, password) {
    if (!token) {
        throw new Error('Invite token is required.');
    }

    const res = await fetch(`${AUTH_BASE}/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
    });

    return parseApiResponse(res, 'Failed to accept invite');
}
