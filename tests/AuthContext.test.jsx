import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';
import { STOREFRONT_CART_RESET_EVENT, STOREFRONT_CART_STORAGE_KEY } from '../src/utils/storefrontSession.js';

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? 'https://api.hydroleaf.se';
const LOGIN_URL = `${API_BASE}/api/auth/login`;

afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
});

describe('AuthContext', () => {
    it('persists backend login response fields without frontend assumptions', async () => {
        const backendResponse = {
            token: 'jwt-token',
            userId: 'user-123',
            role: 'ADMIN',
            permissions: ['ADMIN_OVERVIEW_VIEW', 'ADMIN_PERMISSIONS_MANAGE'],
        };

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            text: async () => JSON.stringify(backendResponse),
        })));

        const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.login('user@example.com', 'password123');
        });

        expect(global.fetch).toHaveBeenCalledWith(LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
        });

        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.token).toBe(backendResponse.token);
        expect(result.current.userId).toBe(backendResponse.userId);
        expect(result.current.role).toBe(backendResponse.role);
        expect(result.current.permissions).toEqual(backendResponse.permissions);
    });

    it('rejects login when backend omits required fields', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            text: async () => JSON.stringify({ token: 'token-without-role' }),
        })));

        const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
        const { result } = renderHook(() => useAuth(), { wrapper });

        let response;
        await act(async () => {
            response = await result.current.login('user@example.com', 'secret');
        });

        expect(response.success).toBe(false);
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.role).toBe(null);
    });

    it('clears storefront cart/session persistence and notifies storefront on logout', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            text: async () => JSON.stringify({}),
            json: async () => ({}),
            headers: { get: () => 'application/json' },
            clone() {
                return this;
            },
        })));

        window.localStorage.setItem(STOREFRONT_CART_STORAGE_KEY, JSON.stringify({
            cartId: 'cart-old',
            sessionId: 'session-old',
        }));

        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.logout({ redirect: false });
        });

        expect(window.localStorage.getItem(STOREFRONT_CART_STORAGE_KEY)).toBe(null);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: STOREFRONT_CART_RESET_EVENT }));
    });
});
