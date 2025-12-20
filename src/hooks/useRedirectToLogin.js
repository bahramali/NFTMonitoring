import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export function useRedirectToLogin() {
    const { logout } = useAuth();

    return useCallback(() => {
        logout({ redirect: false });
        if (typeof window !== 'undefined') {
            window.location.assign('/login');
        }
    }, [logout]);
}

export default useRedirectToLogin;
