import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    CUSTOMER_PROFILE_UPDATE_METHOD,
    CUSTOMER_PROFILE_UPDATE_PATH,
    updateCustomerProfile,
} from '../src/api/customer.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const UPDATE_URL = `${API_BASE}${CUSTOMER_PROFILE_UPDATE_PATH}`;

const createJsonResponse = ({ ok = true, status = 200, body = { ok: true } } = {}) => ({
    ok,
    status,
    bodyUsed: false,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
        return this;
    },
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('customer profile API', () => {
    it('uses the supported method and path for profile updates', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => createJsonResponse()));

        await updateCustomerProfile('token-123', { fullName: 'Ada Lovelace' });

        expect(global.fetch).toHaveBeenCalledWith(UPDATE_URL, {
            method: CUSTOMER_PROFILE_UPDATE_METHOD,
            headers: {
                Authorization: 'Bearer token-123',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fullName: 'Ada Lovelace' }),
            signal: undefined,
        });
    });

    it('surfaces unsupported profile updates instead of silently failing', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => createJsonResponse({ ok: false, status: 405 })));

        await expect(updateCustomerProfile('token-123', { fullName: 'Ada Lovelace' })).rejects.toMatchObject({
            isUnsupported: true,
        });
    });
});
