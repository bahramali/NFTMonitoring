import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Sidebar from '../pages/common/Sidebar';
import { useAuth } from '../context/AuthContext.jsx';
import { hasInternalAccess } from '../utils/roleAccess.js';
import styles from './AppShellLayout.module.css';

export default function StorefrontLayout() {
    const { isAuthenticated, role, roles, loadingProfile } = useAuth();
    const internalAccess = hasInternalAccess({ role, roles });
    const hasRoleInfo = (roles?.length ?? 0) > 0 || Boolean(role);
    const canRenderSidebar = !loadingProfile || hasRoleInfo;
    const showSidebar = canRenderSidebar && isAuthenticated && internalAccess;

    return (
        <div className={styles.shell}>
            <Navbar />
            <div className={styles.body}>
                {showSidebar ? <Sidebar /> : null}
                <main className={styles.main}>
                    <div className={styles.content}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
