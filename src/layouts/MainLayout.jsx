import React from 'react';
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/common/Sidebar";
import { ReportsFiltersProvider } from "../pages/Reports/context/ReportsFiltersContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./MainLayout.module.css";

export default function MainLayout() {
    const { username, logout } = useAuth();

    return (
        <ReportsFiltersProvider>
            <div className={styles.layout}>
                <Sidebar />
                <main className={styles.main}>
                    <div className={styles.userBar}>
                        <div className={styles.userDetails}>
                            <span className={styles.userLabel}>Signed in as</span>
                            <span className={styles.username}>{username || 'User'}</span>
                        </div>
                        <button className={styles.logoutButton} type="button" onClick={logout}>
                            Log out
                        </button>
                    </div>
                    <Outlet />
                </main>
            </div>
        </ReportsFiltersProvider>
    );
}
