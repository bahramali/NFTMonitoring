const ROLE_ROUTES = {
    SUPER_ADMIN: '/admin/home',
    ADMIN: '/admin/overview',
    WORKER: '/worker/dashboard',
    CUSTOMER: '/my-page',
};

export function getDefaultRouteForRole(role) {
    return ROLE_ROUTES[role] || '/';
}

export { ROLE_ROUTES };
