import React, { useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { AdminSidebar, MonitoringSidebar, StoreSidebar } from '../pages/common/Sidebar';
import { ReportsFiltersProvider } from '../pages/Reports/context/ReportsFiltersContext.jsx';
import styles from './AppShellLayout.module.css';

export default function AppShellLayout() {
    const location = useLocation();

    const { pathname } = location;
    const isStore = pathname.startsWith('/store');
    const isMonitoring = pathname.startsWith('/monitoring');
    const isAdmin = pathname.startsWith('/admin');

    useEffect(() => {
        // Temporary log to confirm runtime is using the updated layout.
        console.log('USING NEW LAYOUT v2');
    }, []);

    const sidebar = useMemo(() => {
        if (isMonitoring) return <MonitoringSidebar />;
        if (isStore) return <StoreSidebar />;
        if (isAdmin) return <AdminSidebar />;
        return null;
    }, [isAdmin, isMonitoring, isStore]);

    return (
        <ReportsFiltersProvider>
            <div className={styles.shell}>
                <Navbar />
                <div className={styles.body}>
                    {sidebar}
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
