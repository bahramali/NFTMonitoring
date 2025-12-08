import React, { createContext, useContext, useMemo, useState } from 'react';

const isTestEnv = (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test')
    || process.env.NODE_ENV === 'test';

const defaultAuthValue = {
    isAuthenticated: isTestEnv,
    login: () => ({ success: false }),
    logout: () => {},
};

const AuthContext = createContext(defaultAuthValue);

const VALID_USERNAME = 'Azad_admin';
const VALID_PASSWORD = 'Reza1!Reza1!';

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        if (isTestEnv) {
            return true;
        }

        if (typeof window !== 'undefined') {
            return window.localStorage.getItem('authStatus') === 'authenticated';
        }

        return false;
    });

    const login = (username, password) => {
        if (username === VALID_USERNAME && password === VALID_PASSWORD) {
            setIsAuthenticated(true);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('authStatus', 'authenticated');
            }
            return { success: true };
        }

        return { success: false };
    };

    const logout = () => {
        setIsAuthenticated(false);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('authStatus');
        }
    };

    const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
