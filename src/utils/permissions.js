export const STORE_PERMISSION_KEY = 'ADMIN_STORE';
export const STORE_PERMISSION_FALLBACK = 'ADMIN_DASHBOARD';

export function hasStoreAdminAccess(role, permissions = []) {
    if (role === 'SUPER_ADMIN') return true;
    if (role !== 'ADMIN') return false;
    if (!Array.isArray(permissions)) return false;
    return permissions.includes(STORE_PERMISSION_KEY) || permissions.includes(STORE_PERMISSION_FALLBACK);
}

export function findPermissionLabel(definitions = [], key) {
    if (!key) return '';
    const match = definitions.find((item) => item?.key === key);
    if (match?.label) return match.label;
    return key.replaceAll('_', ' ').toLowerCase();
}
