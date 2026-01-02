import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getDefaultRouteForUser } from '../utils/roleRoutes.js';
import { hasInternalAccess, isCustomer } from '../utils/roleAccess.js';

export default function CustomerRoute({ children }) {
    const { isAuthenticated, role, roles, permissions, loadingProfile } = useAuth();
    const location = useLocation();
    const hasRoleInfo = (roles?.length ?? 0) > 0 || Boolean(role);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (loadingProfile && !hasRoleInfo) {
        return null;
    }

    if (hasInternalAccess({ role, roles })) {
        const target = getDefaultRouteForUser({ role, roles, permissions });
        return <Navigate to={target} replace />;
    }

    if (!isCustomer({ role, roles })) {
        return <Navigate to="/store" replace />;
    }

    return children;
}
