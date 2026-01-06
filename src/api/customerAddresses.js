import { authFetch, buildAuthHeaders, parseApiResponse } from './http.js';

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? 'https://api.hydroleaf.se';
const ADDRESS_URL = `${API_BASE}/api/me/addresses`;

const unauthorizedStatuses = new Set([401, 403]);
const unsupportedStatuses = new Set([404, 501]);

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

export async function fetchCustomerAddresses(token, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to load addresses');
    const res = await authFetch(
        ADDRESS_URL,
        {
            headers: buildAuthHeaders(token),
            signal,
        },
        { token },
    );

    try {
        return await parseApiResponse(res, 'Failed to load addresses');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        markUnsupported(error);
        throw error;
    }
}

export async function createCustomerAddress(token, payload, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to create an address');
    const res = await authFetch(
        ADDRESS_URL,
        {
            method: 'POST',
            headers: buildAuthHeaders(token),
            body: JSON.stringify(payload ?? {}),
            signal,
        },
        { token },
    );

    try {
        return await parseApiResponse(res, 'Failed to create address');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        markUnsupported(error);
        throw error;
    }
}

export async function updateCustomerAddress(token, addressId, payload, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to update an address');
    if (!addressId) throw new Error('Address ID is required');
    const res = await authFetch(
        `${ADDRESS_URL}/${encodeURIComponent(addressId)}`,
        {
            method: 'PUT',
            headers: buildAuthHeaders(token),
            body: JSON.stringify(payload ?? {}),
            signal,
        },
        { token },
    );

    try {
        return await parseApiResponse(res, 'Failed to update address');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        markUnsupported(error);
        throw error;
    }
}

export async function deleteCustomerAddress(token, addressId, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to delete an address');
    if (!addressId) throw new Error('Address ID is required');
    const res = await authFetch(
        `${ADDRESS_URL}/${encodeURIComponent(addressId)}`,
        {
            method: 'DELETE',
            headers: buildAuthHeaders(token),
            signal,
        },
        { token },
    );

    try {
        return await parseApiResponse(res, 'Failed to delete address');
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        markUnsupported(error);
        throw error;
    }
}

export async function setDefaultCustomerAddress(token, addressId, { signal, onUnauthorized } = {}) {
    if (!token) throw new Error('Authentication is required to update the default address');
    if (!addressId) throw new Error('Address ID is required');

    const attemptDefaultRoute = async (url, body) => {
        const res = await authFetch(
            url,
            {
                method: 'PUT',
                headers: buildAuthHeaders(token),
                body: body ? JSON.stringify(body) : undefined,
                signal,
            },
            { token },
        );
        return parseApiResponse(res, 'Failed to set default address');
    };

    try {
        return await attemptDefaultRoute(`${ADDRESS_URL}/${encodeURIComponent(addressId)}/default`);
    } catch (error) {
        if (handleUnauthorized(error, onUnauthorized)) return null;
        if ([404, 405, 501].includes(error?.status)) {
            try {
                return await attemptDefaultRoute(`${ADDRESS_URL}/default`, { id: addressId });
            } catch (fallbackError) {
                if (handleUnauthorized(fallbackError, onUnauthorized)) return null;
                markUnsupported(fallbackError);
                throw fallbackError;
            }
        }
        markUnsupported(error);
        throw error;
    }
}
