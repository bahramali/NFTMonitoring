import React from 'react';
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/common/Sidebar";
import { ReportsFiltersProvider } from "../pages/Reports/context/ReportsFiltersContext.jsx";
import styles from "./MainLayout.module.css";

export default function MainLayout() {
    return (
        <ReportsFiltersProvider>
            <div className={styles.layout}>
                <Sidebar />
                <main className={styles.main}>
                    <Outlet />
                </main>
            </div>
        </ReportsFiltersProvider>
    );
}
