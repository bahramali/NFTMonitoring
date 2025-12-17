import { parseApiResponse } from './http.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const BASE_URL = `${API_BASE}/api/super-admin/admins`;
const PERMISSIONS_URL = `${API_BASE}/api/admin/permissions`;

const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
});

export async function fetchAdmins(token) {
    const res = await fetch(BASE_URL, { headers: authHeaders(token) });
    return parseApiResponse(res, 'Failed to load admins');
}

export async function fetchAdminPermissions(token) {
    const res = await fetch(PERMISSIONS_URL, { headers: authHeaders(token) });
    return parseApiResponse(res, 'Failed to load permissions');
}

export async function inviteAdmin(payload, token) {
    const res = await fetch(`${BASE_URL}/invite`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(payload),
    });
    return parseApiResponse(res, 'Failed to send admin invite');
}

export async function updateAdminPermissions(id, permissions, token) {
    const res = await fetch(`${BASE_URL}/${id}/permissions`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ permissions }),
    });
    return parseApiResponse(res, 'Failed to update permissions');
}

export async function updateAdminStatus(id, status, token) {
    const res = await fetch(`${BASE_URL}/${id}/status`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ status }),
    });
    return parseApiResponse(res, 'Failed to update status');
}

export async function deleteAdmin(id, token) {
    const res = await fetch(`${BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
    });
    return parseApiResponse(res, 'Failed to remove admin');
}

export async function resendAdminInvite(id, token) {
    const res = await fetch(`${BASE_URL}/${id}/resend-invite`, {
        method: 'POST',
        headers: authHeaders(token),
    });
    return parseApiResponse(res, 'Failed to resend invite');
}
