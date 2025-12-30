import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { fetchSessionProfile } from '../api/auth.js';
import normalizeProfile from '../utils/normalizeProfile.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const AUTH_BASE = `${API_BASE}/api/auth`;
const SESSION_DURATION_MS = 30 * 60 * 1000;
const PASSWORD_REQUIREMENTS_MESSAGE = 'Password must be at least 8 characters long.';

const defaultAuthValue = {
    isAuthenticated: false,
    token: null,
    userId: null,
    role: null,
    roles: [],
    permissions: [],
    profile: null,
    profileError: null,
    loadingProfile: false,
    login: async () => ({ success: false }),
    register: async () => ({ success: false }),
    logout: () => {},
    refreshProfile: () => {},
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
            roles: Array.isArray(parsed.roles) ? parsed.roles : [],
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
    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    const setAuthenticatedSession = useCallback((payload) => {
        const { token, userId, role, roles, permissions } = payload || {};
        const normalizedRoles = Array.isArray(roles)
            ? roles.filter(Boolean)
            : role
                ? [role]
                : [];
        const primaryRole = role || normalizedRoles[0] || null;

        if (!token || !userId || !primaryRole) {
            return { success: false, message: 'Login response is missing required fields.' };
        }

        const normalizedPermissions = Array.isArray(permissions) ? permissions : [];
        const nextSession = {
            isAuthenticated: true,
            token,
            userId,
            role: primaryRole,
            roles: normalizedRoles.length > 0 ? normalizedRoles : [primaryRole],
            permissions: normalizedPermissions,
            expiry: Date.now() + SESSION_DURATION_MS,
        };

        setSession(nextSession);
        persistSession(nextSession);
        return { success: true, role: primaryRole, roles: normalizedRoles, permissions: normalizedPermissions };
    }, []);

    const login = useCallback(
        async (email, password) => {
            const trimmedEmail = email?.trim();
            const normalizedPassword = password?.trim();

            if (!trimmedEmail || !normalizedPassword) {
                return { success: false, role: null, message: 'Email and password are required.' };
            }

            try {
                const response = await fetch(`${AUTH_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: trimmedEmail, password: normalizedPassword }),
                });

                const raw = await response.text();
                let payload = {};
                if (raw) {
                    try {
                        payload = JSON.parse(raw);
                    } catch {
                        payload = { message: raw };
                    }
                }

                if (!response.ok) {
                    const message = payload?.message || `Login failed (${response.status})`;
                    return { success: false, role: null, message };
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
                const response = await fetch(`${AUTH_BASE}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: trimmedEmail, password: normalizedPassword }),
                });

                const raw = await response.text();
                let payload = {};
                if (raw) {
                    try {
                        payload = JSON.parse(raw);
                    } catch {
                        payload = { message: raw };
                    }
                }

                if (!response.ok) {
                    const message =
                        payload?.message
                        || (response.status === 400 ? PASSWORD_REQUIREMENTS_MESSAGE : '')
                        || `Registration failed (${response.status})`;
                    return { success: false, message };
                }

                return setAuthenticatedSession({
                    token: payload?.token,
                    userId: payload?.userId,
                    role: payload?.role,
                    permissions: payload?.permissions,
                });
            } catch (error) {
                const message = error?.message || 'Registration failed. Please try again.';
                return { success: false, message };
            }
        },
        [setAuthenticatedSession],
    );

    const logout = useCallback((options = {}) => {
        const { redirect = true } = options;
        setSession(defaultAuthValue);
        setProfile(null);
        setProfileError(null);
        setLoadingProfile(false);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('authSession');
            if (redirect) {
                window.location.assign('/');
            }
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

    const loadProfile = useCallback(
        async (signal) => {
            if (!session.isAuthenticated || !session.token) return;
            setLoadingProfile(true);
            setProfileError(null);

            try {
                const payload = await fetchSessionProfile(session.token, { signal });
                if (signal?.aborted || !payload) return;

                const payloadRoles = Array.isArray(payload?.roles)
                    ? payload.roles
                    : Array.isArray(payload?.role)
                        ? payload.role
                        : payload?.role
                            ? [payload.role]
                            : Array.isArray(payload?.user?.roles)
                                ? payload.user.roles
                                : [];
                const payloadPermissions = Array.isArray(payload?.permissions)
                    ? payload.permissions
                    : Array.isArray(payload?.user?.permissions)
                        ? payload.user.permissions
                        : [];
                const payloadRole = payload?.role || payloadRoles[0] || payload?.user?.role || session.role;

                setProfile(normalizeProfile(payload));
                setSession((prev) => {
                    const nextRoles = payloadRoles.length > 0 ? payloadRoles : prev.roles;
                    const nextPermissions = payloadPermissions.length > 0 ? payloadPermissions : prev.permissions;
                    const nextRole = payloadRole || prev.role;
                    const nextSession = {
                        ...prev,
                        role: nextRole,
                        roles: nextRoles,
                        permissions: nextPermissions,
                    };
                    persistSession(nextSession);
                    return nextSession;
                });
            } catch (error) {
                if (error?.name === 'AbortError') return;
                if (error?.status === 401 || error?.status === 403) {
                    logout({ redirect: false });
                    return;
                }
                setProfileError(error?.message || 'Failed to load profile');
            } finally {
                if (!signal?.aborted) {
                    setLoadingProfile(false);
                }
            }
        },
        [logout, session.isAuthenticated, session.role, session.token],
    );

    useEffect(() => {
        if (!session.isAuthenticated || !session.token) {
            setProfile(null);
            setProfileError(null);
            setLoadingProfile(false);
            return;
        }

        const controller = new AbortController();
        loadProfile(controller.signal);
        return () => {
            controller.abort();
        };
    }, [loadProfile, session.isAuthenticated, session.token]);

    const value = useMemo(
        () => ({
            isAuthenticated: session.isAuthenticated,
            token: session.token,
            userId: session.userId,
            role: session.role,
            roles: session.roles,
            permissions: session.permissions,
            profile,
            profileError,
            loadingProfile,
            login,
            register,
            logout,
            refreshProfile: () => loadProfile(),
        }),
        [
            session.isAuthenticated,
            session.token,
            session.userId,
            session.role,
            session.roles,
            session.permissions,
            profile,
            profileError,
            loadingProfile,
            login,
            register,
            logout,
            loadProfile,
        ],
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
