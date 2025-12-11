import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, requiredRoles = [], requiredPermissions = [] }) {
    const { isAuthenticated, role, permissions } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
        return <Navigate to="/not-authorized" replace />;
    }

    if (requiredPermissions.length > 0 && role === 'ADMIN') {
        const hasAllPermissions = requiredPermissions.every((permission) => permissions?.includes(permission));
        if (!hasAllPermissions) {
            return <Navigate to="/not-authorized" replace />;
        }
    }

    return children;
}
