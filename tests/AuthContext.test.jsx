import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';

afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
});

describe('AuthContext', () => {
    it('persists backend login response fields without frontend assumptions', async () => {
        const backendResponse = {
            token: 'jwt-token',
            userId: 'user-123',
            role: 'ADMIN',
            permissions: ['admin-dashboard', 'admin-team'],
        };

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => backendResponse,
        })));

        const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
            await result.current.login('user@example.com', 'password123');
        });

        expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            json: async () => ({ token: 'token-without-role' }),
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
});
