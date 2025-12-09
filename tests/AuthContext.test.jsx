import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';

describe('AuthContext', () => {
    it('forces the azad_admin user to be treated as a super admin', () => {
        const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
        const { result } = renderHook(() => useAuth(), { wrapper });

        let response;
        act(() => {
            response = result.current.login('azad_admin', 'superadmin', 'ADMIN');
        });

        expect(response.role).toBe('SUPER_ADMIN');
        expect(result.current.userRole).toBe('SUPER_ADMIN');
    });

    it('accepts the updated super admin password for azad_admin', () => {
        const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
        const { result } = renderHook(() => useAuth(), { wrapper });

        let response;
        act(() => {
            response = result.current.login('Azad_admin', 'Reza1!Reza1!', 'SUPER_ADMIN');
        });

        expect(response.success).toBe(true);
        expect(response.role).toBe('SUPER_ADMIN');
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.userRole).toBe('SUPER_ADMIN');
        expect(result.current.username).toBe('Azad_admin');
    });
});
