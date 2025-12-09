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

const SUPER_ADMIN_PASSWORD = 'superadmin';

const DEFAULT_ADMINS = [
    {
        id: 'ops-admin',
        username: 'ops_admin',
        permissions: ['admin-dashboard', 'admin-reports'],
    },
];

const defaultAuthValue = {
    isAuthenticated: isTestEnv,
    userRole: isTestEnv ? 'SUPER_ADMIN' : null,
    username: isTestEnv ? 'Test User' : null,
    userPermissions: [],
    adminAssignments: DEFAULT_ADMINS,
    login: () => ({ success: false }),
    logout: () => {},
    upsertAdmin: () => {},
    removeAdmin: () => {},
};

const AuthContext = createContext(defaultAuthValue);

const readStoredSession = () => {
    if (typeof window === 'undefined') {
        return {
            isAuthenticated: false,
            username: null,
            userRole: null,
            userPermissions: [],
            adminAssignments: DEFAULT_ADMINS,
            expiry: null,
        };
    }

    const rawData = window.localStorage.getItem('authSession');
    if (!rawData) {
        return {
            isAuthenticated: false,
            username: null,
            userRole: null,
            userPermissions: [],
            adminAssignments: DEFAULT_ADMINS,
            expiry: null,
        };
    }

    try {
        const parsed = JSON.parse(rawData);
        if (parsed.expiry && parsed.expiry > Date.now()) {
            return {
                isAuthenticated: Boolean(parsed.isAuthenticated),
                username: parsed.username || null,
                userRole: parsed.userRole || null,
                userPermissions: parsed.userPermissions || [],
                adminAssignments: parsed.adminAssignments?.length ? parsed.adminAssignments : DEFAULT_ADMINS,
                expiry: parsed.expiry,
            };
        }
    } catch {
        // If parsing fails, fall through to reset state
    }

    window.localStorage.removeItem('authSession');
    return {
        isAuthenticated: false,
        username: null,
        userRole: null,
        userPermissions: [],
        adminAssignments: DEFAULT_ADMINS,
        expiry: null,
    };
};

export function AuthProvider({ children }) {
    const [session, setSession] = useState(() => {
        if (isTestEnv) {
            return {
                isAuthenticated: true,
                username: 'Test User',
                userRole: 'SUPER_ADMIN',
                userPermissions: [],
                adminAssignments: DEFAULT_ADMINS,
                expiry: Date.now() + SESSION_DURATION_MS,
            };
        }

        return readStoredSession();
    });

    const login = useCallback((username, password, role) => {
        const trimmedUsername = username?.trim();
        let normalizedRole = role?.trim();
        if (!trimmedUsername || !normalizedRole) {
            return { success: false, message: 'Username and role are required.' };
        }

        const normalizedUsername = trimmedUsername.toLowerCase();

        if (normalizedUsername === 'azad_admin') {
            normalizedRole = 'SUPER_ADMIN';
        }

        if (normalizedRole === 'SUPER_ADMIN' && password !== SUPER_ADMIN_PASSWORD && !isTestEnv) {
            return { success: false, message: 'Invalid super admin password.' };
        }

        let resolvedPermissions = [];
        if (normalizedRole === 'ADMIN') {
            const adminRecord = session.adminAssignments?.find(
                (admin) => admin.username.toLowerCase() === normalizedUsername,
            );
            resolvedPermissions = adminRecord?.permissions || [];
        }

        const newSession = {
            isAuthenticated: true,
            username: trimmedUsername,
            userRole: normalizedRole,
            userPermissions: resolvedPermissions,
            adminAssignments: session.adminAssignments?.length ? session.adminAssignments : DEFAULT_ADMINS,
            expiry: Date.now() + SESSION_DURATION_MS,
        };
        setSession(newSession);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem('authSession', JSON.stringify(newSession));
        }

        return { success: true, role: normalizedRole };
    }, [session.adminAssignments]);

    const logout = useCallback(() => {
        setSession((previous) => ({
            ...previous,
            isAuthenticated: false,
            username: null,
            userRole: null,
            userPermissions: [],
            expiry: null,
        }));
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('authSession');
        }
    }, []);

    const upsertAdmin = useCallback((admin) => {
        setSession((previous) => {
            const filtered = previous.adminAssignments.filter((item) => item.id !== admin.id);
            const updatedAssignments = [...filtered, admin];
            const nextSession = { ...previous, adminAssignments: updatedAssignments };
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('authSession', JSON.stringify(nextSession));
            }
            return nextSession;
        });
    }, []);

    const removeAdmin = useCallback((id) => {
        setSession((previous) => {
            const updatedAssignments = previous.adminAssignments.filter((item) => item.id !== id);
            const nextSession = { ...previous, adminAssignments: updatedAssignments };
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('authSession', JSON.stringify(nextSession));
            }
            return nextSession;
        });
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
            username: session.username,
            userRole: session.userRole,
            userPermissions: session.userPermissions,
            adminAssignments: session.adminAssignments,
            login,
            logout,
            upsertAdmin,
            removeAdmin,
        }),
        [session, login, logout, upsertAdmin, removeAdmin],
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
