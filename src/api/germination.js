import { authFetch } from "./http.js";

import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const BASE_URL = `${API_BASE}/api/germination`;

function normalizeStatus(json) {
    if (!json || typeof json !== "object") {
        return { startTime: null };
    }

    const startTime = json.startTime ?? json.startedAt ?? json.triggeredAt ?? null;
    return { startTime: startTime || null };
}

export async function getGerminationStatus({ signal } = {}) {
    const response = await authFetch(BASE_URL, { signal });
    if (response.status === 404) {
        return { startTime: null };
    }
    if (!response.ok) {
        throw new Error(`Failed to load germination status: ${response.status}`);
    }
    const json = await response.json();
    return normalizeStatus(json);
}

export async function updateGerminationStart(startTime, { signal } = {}) {
    const response = await authFetch(BASE_URL, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ startTime }),
        signal,
    });

    if (!response.ok) {
        throw new Error(`Failed to update germination start time: ${response.status}`);
    }

    const json = await response.json();
    return normalizeStatus(json);
}

export async function triggerGerminationStart({ signal } = {}) {
    const response = await authFetch(`${BASE_URL}/start`, {
        method: "POST",
        signal,
    });

    if (!response.ok) {
        throw new Error(`Failed to trigger germination start: ${response.status}`);
    }

    const json = await response.json();
    return normalizeStatus(json);
}
