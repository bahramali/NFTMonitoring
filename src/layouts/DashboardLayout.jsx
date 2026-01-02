import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Sidebar from '../pages/common/Sidebar';
import { ReportsFiltersProvider } from '../pages/Reports/context/ReportsFiltersContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { hasInternalAccess } from '../utils/roleAccess.js';
import styles from './AppShellLayout.module.css';

export default function DashboardLayout() {
    const location = useLocation();
    const { isAuthenticated, role, roles, loadingProfile } = useAuth();
    const internalAccess = hasInternalAccess({ role, roles });
    const hasRoleInfo = (roles?.length ?? 0) > 0 || Boolean(role);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (loadingProfile && !hasRoleInfo) {
        return (
            <div className={styles.shell}>
                <Navbar />
                <div className={styles.body}>
                    <main className={styles.main}>
                        <div className={styles.content} />
                    </main>
                </div>
            </div>
        );
    }

    if (!internalAccess) {
        return <Navigate to="/store" replace />;
    }

    return (
        <ReportsFiltersProvider>
            <div className={styles.shell}>
                <Navbar />
                <div className={styles.body}>
                    <Sidebar />
                    <main className={styles.main}>
                        <div className={styles.content}>
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>
        </ReportsFiltersProvider>
    );
}
