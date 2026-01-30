import { authFetch, parseApiResponse } from './http.js';
import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const MONITORING_PAGES_URL = `${API_BASE}/api/admin/monitoring-pages`;
const RACKS_URL = `${API_BASE}/api/racks`;

const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
});

export async function listAdminMonitoringPages(token) {
    const res = await authFetch(MONITORING_PAGES_URL, { headers: authHeaders(token) }, { token });
    return parseApiResponse(res, 'Failed to load monitoring pages');
}

export async function createAdminMonitoringPage(payload, token) {
    const res = await authFetch(
        MONITORING_PAGES_URL,
        {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify(payload),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to create monitoring page');
}

export async function updateAdminMonitoringPage(id, payload, token) {
    const res = await authFetch(
        `${MONITORING_PAGES_URL}/${id}`,
        {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify(payload),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to update monitoring page');
}

export async function deleteAdminMonitoringPage(id, token) {
    const res = await authFetch(
        `${MONITORING_PAGES_URL}/${id}`,
        {
            method: 'DELETE',
            headers: authHeaders(token),
        },
        { token },
    );
    return parseApiResponse(res, 'Failed to delete monitoring page');
}

export async function listRacks(token) {
    const res = await authFetch(RACKS_URL, { headers: authHeaders(token) }, { token });
    return parseApiResponse(res, 'Failed to load racks');
}
