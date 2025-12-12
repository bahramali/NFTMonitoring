import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

const SESSION_DURATION_MS = 30 * 60 * 1000;

const defaultAuthValue = {
    isAuthenticated: false,
    token: null,
    userId: null,
    role: null,
    permissions: [],
    login: async () => ({ success: false }),
    register: async () => ({ success: false }),
    logout: () => {},
};

const AuthContext = createContext(defaultAuthValue);

const readStoredSession = () => {
    if (typeof window === 'undefined') {
        return defaultAuthValue;
    }

    const rawData = window.localStorage.getItem('authSession');
    if (!rawData) return defaultAuthValue;

    try {
        const parsed = JSON.parse(rawData);
        if (parsed.expiry && parsed.expiry <= Date.now()) {
            return defaultAuthValue;
        }

        return {
            isAuthenticated: Boolean(parsed.isAuthenticated),
            token: parsed.token || null,
            userId: parsed.userId || null,
            role: parsed.role || null,
            permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
            expiry: parsed.expiry || null,
        };
    } catch {
        return defaultAuthValue;
    }
};

const persistSession = (session) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('authSession', JSON.stringify(session));
};

export function AuthProvider({ children }) {
    const [session, setSession] = useState(() => readStoredSession());

    const setAuthenticatedSession = useCallback((payload) => {
        const { token, userId, role, permissions } = payload || {};
        if (!token || !userId || !role) {
            return { success: false, message: 'Login response is missing required fields.' };
        }

        const normalizedPermissions = Array.isArray(permissions) ? permissions : [];
        const nextSession = {
            isAuthenticated: true,
            token,
            userId,
            role,
            permissions: normalizedPermissions,
            expiry: Date.now() + SESSION_DURATION_MS,
        };

        setSession(nextSession);
        persistSession(nextSession);
        return { success: true, role };
    }, []);

    const login = useCallback(
        async (email, password) => {
            const trimmedEmail = email?.trim();
            const normalizedPassword = password?.trim();

            if (!trimmedEmail || !normalizedPassword) {
                return { success: false, role: null, message: 'Email and password are required.' };
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: trimmedEmail, password: normalizedPassword }),
                });

                const text = await response.text();
                let payload;

                try {
                    payload = JSON.parse(text || '{}');
                } catch (parseError) {
                    payload = { message: text };
                }

                if (!response.ok) {
                    return { success: false, role: null, message: payload?.message || 'Login failed.' };
                }

                return setAuthenticatedSession({
                    token: payload?.token,
                    userId: payload?.userId,
                    role: payload?.role,
                    permissions: payload?.permissions,
                });
            } catch (error) {
                const message = error?.message || 'Login failed. Please try again.';
                return { success: false, role: null, message };
            }
        },
        [setAuthenticatedSession],
    );

    const register = useCallback(
        async (email, password) => {
            const trimmedEmail = email?.trim();
            const normalizedPassword = password?.trim();

            if (!trimmedEmail || !normalizedPassword) {
                return { success: false, message: 'Email and password are required.' };
            }

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: trimmedEmail, password: normalizedPassword }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return { success: false, message: errorText || 'Registration failed.' };
                }

                const data = await response.json();
                return setAuthenticatedSession({
                    token: data?.token,
                    userId: data?.userId,
                    role: data?.role,
                    permissions: data?.permissions,
                });
            } catch (error) {
                const message = error?.message || 'Registration failed. Please try again.';
                return { success: false, message };
            }
        },
        [setAuthenticatedSession],
    );

    const logout = useCallback(() => {
        setSession(defaultAuthValue);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('authSession');
            window.location.assign('/');
        }
    }, []);

    useEffect(() => {
        if (!session.isAuthenticated) {
            return undefined;
        }

        const expiry = session.expiry || 0;
        if (!expiry || expiry <= Date.now()) {
            logout();
            return undefined;
        }

        const timeoutId = window.setTimeout(logout, expiry - Date.now());
        return () => window.clearTimeout(timeoutId);
    }, [logout, session.expiry, session.isAuthenticated]);

    const value = useMemo(
        () => ({
            isAuthenticated: session.isAuthenticated,
            token: session.token,
            userId: session.userId,
            role: session.role,
            permissions: session.permissions,
            login,
            register,
            logout,
        }),
        [session.isAuthenticated, session.token, session.userId, session.role, session.permissions, login, register, logout],
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}

export default AuthProvider;
