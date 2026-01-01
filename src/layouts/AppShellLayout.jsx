import React, { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Sidebar from '../pages/common/Sidebar';
import { ReportsFiltersProvider } from '../pages/Reports/context/ReportsFiltersContext.jsx';
import styles from './AppShellLayout.module.css';

export default function AppShellLayout() {
    const location = useLocation();

    const activeSection = useMemo(() => {
        if (location.pathname.startsWith('/monitoring')) return 'monitoring';
        if (location.pathname.startsWith('/store')) return 'store';
        if (location.pathname.startsWith('/admin')) return 'admin';
        return null;
    }, [location.pathname]);

    return (
        <ReportsFiltersProvider>
            <div className={styles.shell}>
                <Navbar />
                <div className={styles.body}>
                    {activeSection ? <Sidebar activeSection={activeSection} /> : null}
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
