import { authFetch, buildAuthHeaders, parseApiResponse } from './http.js';
import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const MONITORING_PAGES_URL = `${API_BASE}/api/monitoring-pages`;
const ADMIN_MONITORING_PAGES_URL = `${API_BASE}/api/admin/monitoring-pages`;
const RACKS_URL = `${API_BASE}/api/racks`;
const TELEMETRY_TARGETS_URL = `${API_BASE}/api/telemetry-targets`;

const requestJson = async (url, options, errorMessage) => {
    const response = await authFetch(url, options);
    return parseApiResponse(response, errorMessage);
};

export const getMonitoringPages = ({ signal } = {}) =>
    requestJson(MONITORING_PAGES_URL, { signal }, 'Failed to load monitoring pages');

export const getMonitoringPageBySlug = (slug, { signal } = {}) =>
    requestJson(
        `${MONITORING_PAGES_URL}/${encodeURIComponent(slug)}`,
        { signal },
        'Unable to load monitoring page',
    );

export const adminListMonitoringPages = ({ signal } = {}) =>
    requestJson(
        ADMIN_MONITORING_PAGES_URL,
        { signal, headers: buildAuthHeaders() },
        'Failed to load monitoring pages',
    );

export const adminCreateMonitoringPage = (payload, { signal } = {}) =>
    requestJson(
        ADMIN_MONITORING_PAGES_URL,
        {
            method: 'POST',
            headers: buildAuthHeaders(),
            body: JSON.stringify(payload),
            signal,
        },
        'Failed to create monitoring page',
    );

export const adminUpdateMonitoringPage = (id, payload, { signal } = {}) =>
    requestJson(
        `${ADMIN_MONITORING_PAGES_URL}/${encodeURIComponent(id)}`,
        {
            method: 'PUT',
            headers: buildAuthHeaders(),
            body: JSON.stringify(payload),
            signal,
        },
        'Failed to update monitoring page',
    );

export const adminDeleteMonitoringPage = (id, { signal } = {}) =>
    requestJson(
        `${ADMIN_MONITORING_PAGES_URL}/${encodeURIComponent(id)}`,
        {
            method: 'DELETE',
            headers: buildAuthHeaders(),
            signal,
        },
        'Failed to delete monitoring page',
    );

export const listRacks = ({ signal } = {}) =>
    requestJson(RACKS_URL, { signal, headers: buildAuthHeaders() }, 'Failed to load racks');

export const listTelemetryTargets = (system, { signal } = {}) => {
    const query = new URLSearchParams();
    if (system) {
        query.set('system', system);
    }
    const url = query.toString() ? `${TELEMETRY_TARGETS_URL}?${query}` : TELEMETRY_TARGETS_URL;
    return requestJson(url, { signal, headers: buildAuthHeaders() }, 'Failed to load telemetry targets');
};
