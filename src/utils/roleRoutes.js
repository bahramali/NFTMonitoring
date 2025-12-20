const ROLE_ROUTES = {
    SUPER_ADMIN: '/super-admin',
    ADMIN: '/admin',
    WORKER: '/worker/dashboard',
    CUSTOMER: '/my-page',
};

export function getDefaultRouteForRole(role) {
    return ROLE_ROUTES[role] || '/';
}

export { ROLE_ROUTES };
