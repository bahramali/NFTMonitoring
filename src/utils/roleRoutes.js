import { PERMISSIONS, hasPerm } from './permissions.js';

const ROLE_ROUTES = {
    SUPER_ADMIN: '/admin/home',
    ADMIN: '/admin/overview',
    WORKER: '/monitoring/overview',
    CUSTOMER: '/store/home',
};

export function getDefaultRouteForUser({ role, roles = [], permissions = [] } = {}) {
    const availableRoles = roles?.length ? roles : role ? [role] : [];
    const isSuperAdmin = availableRoles.includes('SUPER_ADMIN');
    const me = { permissions };

    if (isSuperAdmin) return ROLE_ROUTES.SUPER_ADMIN;
    if (hasPerm(me, PERMISSIONS.ADMIN_OVERVIEW_VIEW)) return ROLE_ROUTES.ADMIN;
    if (hasPerm(me, PERMISSIONS.MONITORING_VIEW)) return ROLE_ROUTES.WORKER;
    if (hasPerm(me, PERMISSIONS.STORE_VIEW)) return '/store/admin/customers';
    if (availableRoles.includes('CUSTOMER')) return ROLE_ROUTES.CUSTOMER;

    return '/not-authorized';
}

export { ROLE_ROUTES };
