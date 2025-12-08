import React, {
    createContext,
    useContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

const isTestEnv = (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test')
    || process.env.NODE_ENV === 'test';

const SESSION_DURATION_MS = 30 * 60 * 1000;

const defaultAuthValue = {
    isAuthenticated: isTestEnv,
    user: isTestEnv ? { username: 'Test User' } : null,
    login: () => ({ success: false }),
    logout: () => {},
};

const AuthContext = createContext(defaultAuthValue);

const VALID_USERNAME = 'Azad_admin';
const VALID_PASSWORD = 'Reza1!Reza1!';

const readStoredSession = () => {
    if (typeof window === 'undefined') {
        return { isAuthenticated: false, user: null, expiry: null };
    }

    const storedStatus = window.localStorage.getItem('authStatus');
    const storedUser = window.localStorage.getItem('authUser');
    const storedExpiry = Number(window.localStorage.getItem('authExpiry'));

    if (storedStatus === 'authenticated' && storedExpiry && storedExpiry > Date.now()) {
        return {
            isAuthenticated: true,
            user: storedUser ? { username: storedUser } : null,
            expiry: storedExpiry,
        };
    }

    window.localStorage.removeItem('authStatus');
    window.localStorage.removeItem('authUser');
    window.localStorage.removeItem('authExpiry');

    return { isAuthenticated: false, user: null, expiry: null };
};

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        if (isTestEnv) {
            return true;
        }

        return readStoredSession().isAuthenticated;
    });

    const [user, setUser] = useState(() => {
        if (isTestEnv) {
            return { username: 'Test User' };
        }

        return readStoredSession().user;
    });

    const login = (username, password) => {
        const trimmedUsername = username?.trim();
        if (trimmedUsername === VALID_USERNAME && password === VALID_PASSWORD) {
            setIsAuthenticated(true);
            setUser({ username: trimmedUsername });
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('authStatus', 'authenticated');
                window.localStorage.setItem('authUser', trimmedUsername);
                window.localStorage.setItem('authExpiry', `${Date.now() + SESSION_DURATION_MS}`);
            }
            return { success: true };
        }

        return { success: false };
    };

    const logout = useCallback(() => {
        setIsAuthenticated(false);
        setUser(null);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('authStatus');
            window.localStorage.removeItem('authUser');
            window.localStorage.removeItem('authExpiry');
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            return undefined;
        }

        const storedSession = readStoredSession();
        if (!storedSession.expiry || storedSession.expiry <= Date.now()) {
            logout();
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            logout();
        }, storedSession.expiry - Date.now());

        return () => window.clearTimeout(timeoutId);
    }, [isAuthenticated, logout]);

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
