import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ServiceStatusBanner from '../components/ServiceStatusBanner.jsx';
import styles from './AppShellLayout.module.css';

export default function PublicLayout() {
    return (
        <div className={styles.shell}>
            <ServiceStatusBanner />
            <Navbar />
            <div className={styles.body}>
                <main className={styles.main}>
                    <div className={styles.content}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
