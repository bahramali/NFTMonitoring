import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { hasPerm } from '../utils/permissions.js';

export default function ProtectedRoute({ children, requiredRoles = [], requiredPermissions = [] }) {
    const { isAuthenticated, role, roles, permissions } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    const availableRoles = roles?.length ? roles : role ? [role] : [];
    const requiresSuperAdmin = requiredRoles.includes('SUPER_ADMIN');

    if (requiredRoles.length > 0 && !requiredRoles.some((requiredRole) => availableRoles.includes(requiredRole))) {
        if (requiresSuperAdmin) {
            return <Navigate to="/" replace />;
        }
        return <Navigate to="/not-authorized" replace />;
    }

    const hasSuperAdminRole = availableRoles.includes('SUPER_ADMIN');

    if (requiredPermissions.length > 0 && !hasSuperAdminRole) {
        const me = { permissions };
        const hasAllPermissions = requiredPermissions.every((permission) => hasPerm(me, permission));
        if (!hasAllPermissions) {
            return <Navigate to="/not-authorized" replace />;
        }
    }

    return children;
}
