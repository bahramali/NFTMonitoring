import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    fetchSessionProfile,
    fetchSessionProfileWithCredentials,
    logoutSession,
    refreshAccessToken as requestRefreshAccessToken,
} from '../api/auth.js';
import { configureAuth } from '../api/http.js';
import normalizeProfile from '../utils/normalizeProfile.js';

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? 'https://api.hydroleaf.se';
const AUTH_BASE = `${API_BASE}/api/auth`;
const PASSWORD_REQUIREMENTS_MESSAGE = 'Password must be at least 8 characters long.';

const defaultSession = {
    isAuthenticated: false,
    token: null,
    userId: null,
    role: null,
    roles: [],
    permissions: [],
};

const defaultAuthValue = {
    ...defaultSession,
    profile: null,
    profileError: null,
    loadingProfile: false,
    authNotice: null,
    login: async () => ({ success: false }),
    register: async () => ({ success: false }),
    logout: () => {},
    clearAuthNotice: () => {},
    refreshProfile: () => {},
    completeOAuthLogin: async () => ({ success: false }),
};

const AuthContext = createContext(defaultAuthValue);

const readStoredSession = () => {
    if (typeof window === 'undefined') {
        return defaultSession;
    }

    const rawData = window.localStorage.getItem('authSession');
    if (!rawData) return defaultSession;

    try {
        const parsed = JSON.parse(rawData);
        if (parsed.expiry && parsed.expiry <= Date.now()) {
            return defaultSession;
        }

        return {
            isAuthenticated: Boolean(parsed.isAuthenticated),
            token: parsed.token || null,
            userId: parsed.userId || null,
            role: parsed.role || null,
            roles: Array.isArray(parsed.roles) ? parsed.roles : [],
            permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
        };
    } catch {
        return defaultSession;
    }
};

const normalizeRoles = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload.filter(Boolean);
    return payload ? [payload] : [];
};

const buildSessionPayload = (payload) => {
    const user = payload?.user ?? payload?.profile ?? payload?.data ?? payload ?? {};
    const token =
        payload?.token
        || payload?.accessToken
        || payload?.jwt
        || user?.token
        || user?.accessToken;
    const userId = payload?.userId || user?.id || user?.userId || payload?.id || null;
    const roles = normalizeRoles(payload?.roles || user?.roles || payload?.role || user?.role);
    const role = payload?.role || user?.role || roles[0] || null;
    const permissions = Array.isArray(payload?.permissions)
        ? payload.permissions
        : Array.isArray(user?.permissions)
            ? user.permissions
            : [];

    return {
        token,
        userId,
        role,
        roles,
        permissions,
    };
};

export function AuthProvider({ children }) {
    const [session, setSession] = useState(() => (
        import.meta.env?.MODE === 'test' ? readStoredSession() : defaultSession
    ));
    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [authNotice, setAuthNotice] = useState(null);
    const sessionRef = useRef(session);
    const bootstrapAttemptedRef = useRef(false);

    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    useEffect(() => {
        if (import.meta.env?.MODE !== 'test') {
            return;
        }

        if (session.isAuthenticated) {
            return;
        }

        const storedSession = readStoredSession();
        if (storedSession.isAuthenticated) {
            setSession(storedSession);
        }
    }, [session.isAuthenticated]);

    useEffect(() => {
        if (import.meta.env?.MODE !== 'test') {
            return undefined;
        }

        const handleStorage = (event) => {
            if (event?.key && event.key !== 'authSession') {
                return;
            }

            const storedSession = readStoredSession();
            const currentSession = sessionRef.current;
            if (storedSession.isAuthenticated && !currentSession.isAuthenticated) {
                setSession(storedSession);
                return;
            }

            if (!storedSession.isAuthenticated && currentSession.isAuthenticated) {
                setSession(defaultSession);
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const setAuthenticatedSession = useCallback((payload, { fallback = {} } = {}) => {
        const { token, userId, role, roles, permissions } = payload || {};
        const normalizedRoles = Array.isArray(roles) ? roles.filter(Boolean) : normalizeRoles(role);
        const fallbackRoles = Array.isArray(fallback?.roles) ? fallback.roles : normalizeRoles(fallback?.role);
        const resolvedRoles = normalizedRoles.length > 0 ? normalizedRoles : fallbackRoles;
        const primaryRole = role || resolvedRoles[0] || fallback?.role || null;
        const resolvedToken = token || fallback?.token || null;
        const resolvedUserId = userId || fallback?.userId || null;
        const resolvedPermissions = Array.isArray(permissions) && permissions.length > 0
            ? permissions
            : Array.isArray(fallback?.permissions)
                ? fallback.permissions
                : [];

        if (!resolvedToken || !resolvedUserId || !primaryRole) {
            return { success: false, message: 'Login response is missing required fields.' };
        }

        const nextSession = {
            isAuthenticated: true,
            token: resolvedToken,
            userId: resolvedUserId,
            role: primaryRole,
            roles: resolvedRoles.length > 0 ? resolvedRoles : [primaryRole],
            permissions: resolvedPermissions,
        };

        setSession(nextSession);
        return { success: true, role: primaryRole, roles: nextSession.roles, permissions: resolvedPermissions };
    }, []);

    const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

    const updateAccessToken = useCallback((token) => {
        setSession((prev) => ({
            ...prev,
            token: token || null,
        }));
    }, []);

    const refreshAccessToken = useCallback(async () => {
        const payload = await requestRefreshAccessToken();
        const sessionPayload = buildSessionPayload(payload);
        if (!sessionPayload.token) return null;
        updateAccessToken(sessionPayload.token);
        return sessionPayload.token;
    }, [requestRefreshAccessToken, updateAccessToken]);

    const login = useCallback(
        async (email, password) => {
            const trimmedEmail = email?.trim();
            const normalizedPassword = password?.trim();

            if (!trimmedEmail || !normalizedPassword) {
                return { success: false, role: null, message: 'Email and password are required.' };
            }

            try {
                clearAuthNotice();
                const response = await fetch(`${AUTH_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
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

                return setAuthenticatedSession(buildSessionPayload(payload));
            } catch (error) {
                const message = error?.message || 'Login failed. Please try again.';
                return { success: false, role: null, message };
            }
        },
        [clearAuthNotice, setAuthenticatedSession],
    );

    const completeOAuthLogin = useCallback(
        async ({ signal } = {}) => {
            try {
                clearAuthNotice();
                const payload = await fetchSessionProfileWithCredentials({ signal });
                if (signal?.aborted) {
                    return { success: false, message: 'Sign-in cancelled.' };
                }
                const sessionPayload = buildSessionPayload(payload);
                const result = setAuthenticatedSession(sessionPayload);
                if (!result.success) {
                    return { success: false, message: 'Sign-in failed. Please try again.' };
                }
                setProfile(normalizeProfile(payload));
                return { ...result, roles: sessionPayload.roles };
            } catch (error) {
                if (error?.name === 'AbortError') {
                    return { success: false, message: 'Sign-in cancelled.' };
                }
                return { success: false, message: error?.message || 'Sign-in failed. Please try again.' };
            }
        },
        [clearAuthNotice, setAuthenticatedSession],
    );

    const register = useCallback(
        async (email, password) => {
            const trimmedEmail = email?.trim();
            const normalizedPassword = password?.trim();

            if (!trimmedEmail || !normalizedPassword) {
                return { success: false, message: 'Email and password are required.' };
            }

            try {
                clearAuthNotice();
                const response = await fetch(`${AUTH_BASE}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
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

                return setAuthenticatedSession(buildSessionPayload(payload));
            } catch (error) {
                const message = error?.message || 'Registration failed. Please try again.';
                return { success: false, message };
            }
        },
        [clearAuthNotice, setAuthenticatedSession],
    );

    const logout = useCallback(async (options = {}) => {
        const { redirect = true, redirectTo = '/', clearNotice = true } = options;
        try {
            await logoutSession();
        } catch (error) {
            console.warn('Logout request failed', error);
        }
        setSession(defaultSession);
        setProfile(null);
        setProfileError(null);
        setLoadingProfile(false);
        if (clearNotice) {
            setAuthNotice(null);
        }
        if (typeof window !== 'undefined') {
            if (redirect) {
                window.location.assign(redirectTo);
            }
        }
    }, []);

    const handleAuthFailure = useCallback(
        (reason) => {
            const message = reason === 'refresh_failed'
                ? 'Your session refresh failed. Please sign in again.'
                : 'Your session expired. Please sign in again.';
            setAuthNotice({ type: 'error', message });
            logout({ redirectTo: '/login', clearNotice: false });
        },
        [logout],
    );

    useEffect(() => {
        configureAuth({
            getAccessToken: () => sessionRef.current.token,
            setAccessToken: updateAccessToken,
            refreshAccessToken,
            onAuthFailure: handleAuthFailure,
        });
    }, [handleAuthFailure, refreshAccessToken, updateAccessToken]);

    useEffect(() => {
        if (import.meta.env?.MODE === 'test') {
            return undefined;
        }

        if (session.isAuthenticated || bootstrapAttemptedRef.current) {
            return undefined;
        }

        bootstrapAttemptedRef.current = true;
        const controller = new AbortController();

        const bootstrap = async () => {
            setLoadingProfile(true);
            setProfileError(null);
            try {
                const payload = await requestRefreshAccessToken({ signal: controller.signal });
                if (controller.signal.aborted) return;
                const sessionPayload = buildSessionPayload(payload);
                if (!sessionPayload.token) return;
                updateAccessToken(sessionPayload.token);

                if (sessionPayload.userId && (sessionPayload.role || sessionPayload.roles?.length)) {
                    setAuthenticatedSession(sessionPayload, { fallback: sessionRef.current });
                    setProfile(normalizeProfile(payload));
                    return;
                }

                const profilePayload = await fetchSessionProfile(sessionPayload.token, { signal: controller.signal });
                if (controller.signal.aborted) return;
                const combined = {
                    ...buildSessionPayload(profilePayload),
                    token: sessionPayload.token,
                };
                const result = setAuthenticatedSession(combined, { fallback: sessionRef.current });
                if (result.success) {
                    setProfile(normalizeProfile(profilePayload));
                }
            } catch (error) {
                if (error?.name === 'AbortError') return;
                const hadStoredSession = sessionRef.current.isAuthenticated || sessionRef.current.token;
                if (hadStoredSession && (error?.status === 401 || error?.status === 403)) {
                    setAuthNotice({ type: 'error', message: 'Your session expired. Please sign in again.' });
                } else if (hadStoredSession && error) {
                    setAuthNotice({ type: 'error', message: 'Unable to refresh your session. Please sign in again.' });
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingProfile(false);
                }
            }
        };

        bootstrap();

        return () => {
            controller.abort();
        };
    }, [
        requestRefreshAccessToken,
        session.isAuthenticated,
        setAuthenticatedSession,
        updateAccessToken,
    ]);

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
                setSession((prev) => ({
                    ...prev,
                    role: payloadRole || prev.role,
                    roles: payloadRoles.length > 0 ? payloadRoles : prev.roles,
                    permissions: payloadPermissions.length > 0 ? payloadPermissions : prev.permissions,
                }));
            } catch (error) {
                if (error?.name === 'AbortError') return;
                if (error?.status === 401 || error?.status === 403) {
                    handleAuthFailure('expired');
                    return;
                }
                setProfileError(error?.message || 'Failed to load profile');
            } finally {
                if (!signal?.aborted) {
                    setLoadingProfile(false);
                }
            }
        },
        [handleAuthFailure, session.isAuthenticated, session.role, session.token],
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
            authNotice,
            login,
            register,
            logout,
            clearAuthNotice,
            refreshProfile: () => loadProfile(),
            completeOAuthLogin,
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
            authNotice,
            login,
            register,
            logout,
            clearAuthNotice,
            loadProfile,
            completeOAuthLogin,
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
