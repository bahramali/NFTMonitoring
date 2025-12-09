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
});
