const parseBody = async (response) => {
    // Avoid throwing when the response body was already consumed by another handler.
    if (response.bodyUsed) {
        return { data: null, message: '' };
    }

    const safeResponse =
        typeof response.clone === 'function' && !response.bodyUsed ? response.clone() : response;
    const headers = safeResponse.headers;
    const contentType =
        typeof headers?.get === 'function'
            ? headers.get('content-type') || ''
            : headers?.['content-type'] || headers?.['Content-Type'] || '';
    const isJson = contentType.includes('application/json');

    try {
        if (isJson) {
            const data = await safeResponse.json();
            const message = typeof data === 'object' && data !== null && 'message' in data ? data.message : '';
            return { data, message: message || '' };
        }

        const text = await safeResponse.text();
        if (!text) return { data: null, message: '' };

        // Fallback: if content-type is missing, attempt to parse JSON once.
        try {
            const data = JSON.parse(text);
            const message = typeof data === 'object' && data !== null && 'message' in data ? data.message : '';
            return { data, message: message || text };
        } catch {
            return { data: text, message: text };
        }
    } catch (error) {
        if (response.bodyUsed || safeResponse.bodyUsed) {
            return { data: null, message: '' };
        }
        if (`${error?.message}`.toLowerCase().includes('body stream already read')) {
            return { data: null, message: '' };
        }
        throw error;
    }
};

export async function parseApiResponse(response, defaultError = 'Request failed') {
    const { data, message } = await parseBody(response);
    if (!response.ok) {
        const error = new Error(message || `${defaultError} (${response.status})`);
        error.status = response.status;
        error.payload = data;
        throw error;
    }

    return data;
}

let authConfig = {
    getAccessToken: () => null,
    setAccessToken: () => {},
    refreshAccessToken: null,
    onAuthFailure: null,
};

let refreshPromise = null;

export function configureAuth(config = {}) {
    authConfig = {
        ...authConfig,
        ...config,
    };
}

const resolveTokenFromPayload = (payload) => {
    if (!payload) return null;
    if (typeof payload === 'string') return payload;
    return payload?.token || payload?.accessToken || payload?.jwt || null;
};

const ensureRefresh = async () => {
    if (!authConfig.refreshAccessToken) return null;
    if (!refreshPromise) {
        refreshPromise = Promise.resolve(authConfig.refreshAccessToken())
            .catch((error) => {
                throw error;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
};

export async function authFetch(url, options = {}, { token, retry = true } = {}) {
    const resolvedToken = token ?? authConfig.getAccessToken?.();
    const headers = new Headers(options.headers || {});

    if (!headers.has('Authorization') && resolvedToken) {
        headers.set('Authorization', `Bearer ${resolvedToken}`);
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status !== 401 || !retry || !authConfig.refreshAccessToken) {
        return response;
    }

    try {
        const refreshed = await ensureRefresh();
        const newToken = resolveTokenFromPayload(refreshed);
        if (!newToken) {
            authConfig.onAuthFailure?.('expired');
            return response;
        }

        authConfig.setAccessToken?.(newToken);
        const retryHeaders = new Headers(headers);
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { ...options, headers: retryHeaders });
    } catch (error) {
        authConfig.onAuthFailure?.('refresh_failed', error);
        return response;
    }
}

export const buildAuthHeaders = (token) => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
});
