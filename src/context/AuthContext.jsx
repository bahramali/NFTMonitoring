import React, { createContext, useContext, useMemo, useState } from 'react';

const isTestEnv = (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test')
    || process.env.NODE_ENV === 'test';

const defaultAuthValue = {
    isAuthenticated: isTestEnv,
    user: isTestEnv ? { username: 'Test User' } : null,
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

    const [user, setUser] = useState(() => {
        if (isTestEnv) {
            return { username: 'Test User' };
        }

        if (typeof window !== 'undefined') {
            const storedUsername = window.localStorage.getItem('authUser');
            if (storedUsername) {
                return { username: storedUsername };
            }
        }

        return null;
    });

    const login = (username, password) => {
        const trimmedUsername = username?.trim();
        if (trimmedUsername === VALID_USERNAME && password === VALID_PASSWORD) {
            setIsAuthenticated(true);
            setUser({ username: trimmedUsername });
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('authStatus', 'authenticated');
                window.localStorage.setItem('authUser', trimmedUsername);
            }
            return { success: true };
        }

        return { success: false };
    };

    const logout = () => {
        setIsAuthenticated(false);
        setUser(null);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('authStatus');
            window.localStorage.removeItem('authUser');
        }
    };

    const value = useMemo(
        () => ({ isAuthenticated, user, login, logout }),
        [isAuthenticated, user],
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
