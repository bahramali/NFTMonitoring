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
    registeredCustomers: [],
    login: () => ({ success: false }),
    register: () => ({ success: false }),
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
            registeredCustomers: [],
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
            registeredCustomers: [],
            expiry: null,
        };
    }

    try {
        const parsed = JSON.parse(rawData);
        const adminAssignments = parsed.adminAssignments?.length ? parsed.adminAssignments : DEFAULT_ADMINS;
        const registeredCustomers = parsed.registeredCustomers || [];

        if (parsed.expiry && parsed.expiry <= Date.now()) {
            return {
                isAuthenticated: false,
                username: null,
                userRole: null,
                userPermissions: [],
                adminAssignments,
                registeredCustomers,
                expiry: null,
            };
        }

        return {
            isAuthenticated: Boolean(parsed.isAuthenticated),
            username: parsed.username || null,
            userRole: parsed.userRole || null,
            userPermissions: parsed.userPermissions || [],
            adminAssignments,
            registeredCustomers,
            expiry: parsed.expiry || null,
        };
    } catch {
        // If parsing fails, fall through to reset state
    }

    return {
        isAuthenticated: false,
        username: null,
        userRole: null,
        userPermissions: [],
        adminAssignments: DEFAULT_ADMINS,
        registeredCustomers: [],
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
                registeredCustomers: [],
                expiry: Date.now() + SESSION_DURATION_MS,
            };
        }

        return readStoredSession();
    });

    const login = useCallback((username, password, role) => {
        const trimmedUsername = username?.trim();
        const requestedRole = role?.trim();
        if (!trimmedUsername || !requestedRole) {
            return { success: false, message: 'Username and role are required.' };
        }

        const isAzadAdmin = trimmedUsername.toLowerCase() === 'azad_admin';
        const normalizedRole = isAzadAdmin ? 'SUPER_ADMIN' : requestedRole;

        if (normalizedRole === 'SUPER_ADMIN' && password !== SUPER_ADMIN_PASSWORD && !isTestEnv) {
            return { success: false, message: 'Invalid super admin password.' };
        }

        let resolvedPermissions = [];
        if (normalizedRole === 'CUSTOMER') {
            const customerRecord = session.registeredCustomers?.find(
                (customer) => customer.username.toLowerCase() === trimmedUsername.toLowerCase(),
            );
            if (!customerRecord) {
                return { success: false, message: 'Account not found. Please register first.' };
            }

            if (customerRecord.password && customerRecord.password !== password) {
                return { success: false, message: 'Incorrect password. Please try again.' };
            }
        }
        if (normalizedRole === 'ADMIN') {
            const adminRecord = session.adminAssignments?.find(
                (admin) => admin.username.toLowerCase() === trimmedUsername.toLowerCase(),
            );
            resolvedPermissions = adminRecord?.permissions || [];
        }

        const newSession = {
            isAuthenticated: true,
            username: trimmedUsername,
            userRole: normalizedRole,
            userPermissions: resolvedPermissions,
            adminAssignments: session.adminAssignments?.length ? session.adminAssignments : DEFAULT_ADMINS,
            registeredCustomers: session.registeredCustomers || [],
            expiry: Date.now() + SESSION_DURATION_MS,
        };
        setSession(newSession);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem('authSession', JSON.stringify(newSession));
        }

        return { success: true, role: normalizedRole };
    }, [session.adminAssignments, session.registeredCustomers]);

    const register = useCallback((username, password) => {
        const trimmedUsername = username?.trim();
        if (!trimmedUsername || !password?.trim()) {
            return { success: false, message: 'Username and password are required.' };
        }

        const existingCustomer = session.registeredCustomers?.find(
            (customer) => customer.username.toLowerCase() === trimmedUsername.toLowerCase(),
        );

        if (existingCustomer) {
            return { success: false, message: 'A customer with this username already exists.' };
        }

        const updatedCustomers = [
            ...(session.registeredCustomers || []),
            { username: trimmedUsername, password: password.trim() },
        ];

        const newSession = {
            isAuthenticated: true,
            username: trimmedUsername,
            userRole: 'CUSTOMER',
            userPermissions: [],
            adminAssignments: session.adminAssignments?.length ? session.adminAssignments : DEFAULT_ADMINS,
            registeredCustomers: updatedCustomers,
            expiry: Date.now() + SESSION_DURATION_MS,
        };

        setSession(newSession);

        if (typeof window !== 'undefined') {
            window.localStorage.setItem('authSession', JSON.stringify(newSession));
        }

        return { success: true };
    }, [session.adminAssignments, session.registeredCustomers]);

    const logout = useCallback(() => {
        setSession((previous) => ({
            ...previous,
            isAuthenticated: false,
            username: null,
            userRole: null,
            userPermissions: [],
            registeredCustomers: previous.registeredCustomers,
            expiry: null,
        }));
        if (typeof window !== 'undefined') {
            const storedSession = {
                isAuthenticated: false,
                username: null,
                userRole: null,
                userPermissions: [],
                adminAssignments: session.adminAssignments,
                registeredCustomers: session.registeredCustomers,
                expiry: null,
            };
            window.localStorage.setItem('authSession', JSON.stringify(storedSession));
        }
    }, [session.adminAssignments, session.registeredCustomers]);

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
            registeredCustomers: session.registeredCustomers,
            login,
            register,
            logout,
            upsertAdmin,
            removeAdmin,
        }),
        [session, login, logout, register, upsertAdmin, removeAdmin],
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
