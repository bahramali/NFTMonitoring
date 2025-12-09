import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allowedRoles = [], requiredPermission }) {
    const { isAuthenticated, userRole, userPermissions } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        if (userRole === 'WORKER') {
            return <Navigate to="/worker" replace />;
        }

        if (userRole === 'CUSTOMER') {
            return <Navigate to="/my-page" replace />;
        }

        return <Navigate to="/not-authorized" replace />;
    }

    if (requiredPermission && userRole !== 'SUPER_ADMIN') {
        const hasPermission = userPermissions?.includes(requiredPermission);
        if (!hasPermission) {
            return <Navigate to="/not-authorized" replace />;
        }
    }

    return children;
}
