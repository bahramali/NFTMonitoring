import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Sidebar from '../pages/common/Sidebar';
import { ReportsFiltersProvider } from '../pages/Reports/context/ReportsFiltersContext.jsx';
import styles from './AppShellLayout.module.css';

export default function AppShellLayout() {
    const location = useLocation();
    const isStoreRoute = location.pathname === '/store' || location.pathname.startsWith('/store/');

    useEffect(() => {
        // Temporary log to confirm runtime is using the updated layout.
        console.log('USING NEW LAYOUT v2');
    }, []);

    return (
        <ReportsFiltersProvider>
            <div className={styles.shell}>
                <Navbar />
                <div className={styles.body}>
                    {!isStoreRoute && <Sidebar />}
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
