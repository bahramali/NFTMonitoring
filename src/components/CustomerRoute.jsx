import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getDefaultRouteForRole } from '../utils/roleRoutes.js';

export default function CustomerRoute({ children }) {
    const { isAuthenticated, role } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (role !== 'CUSTOMER') {
        const target = getDefaultRouteForRole(role);
        return <Navigate to={target} replace />;
    }

    return children;
}
