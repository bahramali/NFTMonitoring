import { authFetch, parseApiResponse } from './http.js';

import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const BASE_URL = `${API_BASE}/api/actuators`;

const jsonHeaders = { "Content-Type": "application/json" };

export async function sendLedCommand(payload) {
    const res = await authFetch(`${BASE_URL}/led/command`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    });

    return parseApiResponse(res, 'Failed to send LED command');
}

export async function sendLedSchedule(payload) {
    const res = await authFetch(`${BASE_URL}/led/schedule`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    });

    return parseApiResponse(res, 'Failed to send LED command');
}
