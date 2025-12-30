export const PERMISSIONS = {
    STORE_VIEW: 'STORE_VIEW',
    CUSTOMERS_VIEW: 'CUSTOMERS_VIEW',
    PRODUCTS_MANAGE: 'PRODUCTS_MANAGE',
    ORDERS_MANAGE: 'ORDERS_MANAGE',
    ADMIN_OVERVIEW_VIEW: 'ADMIN_OVERVIEW_VIEW',
    ADMIN_PERMISSIONS_MANAGE: 'ADMIN_PERMISSIONS_MANAGE',
    MONITORING_VIEW: 'MONITORING_VIEW',
};

export const hasPerm = (me, perm) => me?.permissions?.includes(perm);

export function hasStoreAdminAccess(permissions = []) {
    if (!Array.isArray(permissions)) return false;
    return [
        PERMISSIONS.PRODUCTS_MANAGE,
        PERMISSIONS.CUSTOMERS_VIEW,
        PERMISSIONS.ORDERS_MANAGE,
    ].some((permission) => permissions.includes(permission));
}

export function findPermissionLabel(definitions = [], key) {
    if (!key) return '';
    const match = definitions.find((item) => item?.key === key);
    if (match?.label) return match.label;
    return key.replaceAll('_', ' ').toLowerCase();
}
