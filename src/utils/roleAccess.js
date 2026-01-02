export const getAvailableRoles = ({ role, roles } = {}) => {
    const normalizedRoles = Array.isArray(roles) ? roles.filter(Boolean) : [];
    if (normalizedRoles.length > 0) {
        return normalizedRoles;
    }
    return role ? [role] : [];
};

export const hasInternalAccess = ({ role, roles } = {}) => {
    const availableRoles = getAvailableRoles({ role, roles });
    return availableRoles.some((availableRole) => availableRole && availableRole !== 'CUSTOMER');
};

export const isCustomer = ({ role, roles } = {}) => {
    const availableRoles = getAvailableRoles({ role, roles });
    if (!availableRoles.includes('CUSTOMER')) {
        return false;
    }
    return !hasInternalAccess({ role, roles });
};
