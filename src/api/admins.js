import { authFetch, parseApiResponse } from './http.js';

import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const BASE_URL = `${API_BASE}/api/super-admin/admins`;
const PERMISSIONS_URL = `${API_BASE}/api/admin/permissions`;

const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
});

export async function fetchAdmins(token) {
    const res = await authFetch(BASE_URL, { headers: authHeaders(token) }, { token });
    return parseApiResponse(res, 'Failed to load admins');
}

export async function fetchAdminPermissions(token) {
    const res = await authFetch(PERMISSIONS_URL, { headers: authHeaders(token) }, { token });
    return parseApiResponse(res, 'Failed to load permissions');
}

export async function inviteAdmin(payload, token) {
    const res = await authFetch(
        `${BASE_URL}/invite`,
        {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify(payload),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to send admin invite');
}

export async function updateAdminPermissions(id, permissions, token) {
    const res = await authFetch(
        `${BASE_URL}/${id}/permissions`,
        {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify({ permissions }),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to update permissions');
}

export async function updateAdminStatus(id, status, token) {
    const res = await authFetch(
        `${BASE_URL}/${id}/status`,
        {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify({ status }),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to update status');
}

export async function deleteAdmin(id, token) {
    const res = await authFetch(
        `${BASE_URL}/${id}`,
        {
            method: 'DELETE',
            headers: authHeaders(token),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to remove admin');
}

export async function resendAdminInvite(id, token) {
    const res = await authFetch(
        `${BASE_URL}/${id}/resend-invite`,
        {
            method: 'POST',
            headers: authHeaders(token),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to resend invite');
}

export async function fetchPermissionDefinitions(token) {
    const res = await authFetch(
        PERMISSIONS_URL,
        {
            headers: authHeaders(token),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to load permission definitions');
}
