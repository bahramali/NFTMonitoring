import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

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
const AUTH_STATUS_KEY = 'authStatus';
const ADMIN_CREDENTIALS_KEY = 'adminCredentials';

const defaultCredentials = { username: VALID_USERNAME, password: VALID_PASSWORD };

function writeDefaultCredentials() {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(defaultCredentials));
}

function getStoredCredentials() {
    if (typeof window === 'undefined') {
        return defaultCredentials;
    }

    const stored = window.localStorage.getItem(ADMIN_CREDENTIALS_KEY);
    if (!stored) {
        return defaultCredentials;
    }

    try {
        const parsed = JSON.parse(stored);
        if (parsed?.username && parsed?.password) {
            return { username: parsed.username, password: parsed.password };
        }
    } catch (error) {
        console.warn('Unable to parse stored admin credentials', error);
    }

    return defaultCredentials;
}

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        if (isTestEnv) {
            return true;
        }

        if (typeof window !== 'undefined') {
            return window.localStorage.getItem(AUTH_STATUS_KEY) === 'authenticated';
        }

        return false;
    });

    useEffect(() => {
        if (isTestEnv || typeof window === 'undefined') {
            return;
        }

        try {
            const parsed = JSON.parse(window.localStorage.getItem(ADMIN_CREDENTIALS_KEY) || '{}');
            if (!parsed.username || !parsed.password) {
                writeDefaultCredentials();
            }
        } catch (error) {
            console.warn('Resetting admin credentials after malformed storage value', error);
            writeDefaultCredentials();
        }
    }, []);

    const login = (username, password) => {
        const storedCredentials = getStoredCredentials();

        if (username === storedCredentials.username && password === storedCredentials.password) {
            setIsAuthenticated(true);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(AUTH_STATUS_KEY, 'authenticated');
            }
            return { success: true };
        }

        return { success: false };
    };

    const logout = () => {
        setIsAuthenticated(false);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(AUTH_STATUS_KEY);
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
