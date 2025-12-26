import React, { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Sidebar from '../pages/common/Sidebar';
import { ReportsFiltersProvider } from '../pages/Reports/context/ReportsFiltersContext.jsx';
import styles from './AppShellLayout.module.css';

const CONTEXT_ROUTES = [
    { prefix: '/monitoring', label: 'Monitoring' },
    { prefix: '/store', label: 'Store' },
    { prefix: '/admin', label: 'Admin' },
];

export default function AppShellLayout() {
    const location = useLocation();

    const contextLabel = useMemo(() => {
        const match = CONTEXT_ROUTES.find((route) => location.pathname.startsWith(route.prefix));
        return match?.label || 'HydroLeaf';
    }, [location.pathname]);

    return (
        <ReportsFiltersProvider>
            <div className={styles.shell}>
                <Navbar />
                <div className={styles.body}>
                    <Sidebar />
                    <main className={styles.main}>
                        <div className={styles.contextBar}>
                            <span className={styles.contextLabel}>{contextLabel}</span>
                            <span className={styles.contextHint}>Workspace</span>
                        </div>
                        <div className={styles.content}>
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>
        </ReportsFiltersProvider>
    );
}
