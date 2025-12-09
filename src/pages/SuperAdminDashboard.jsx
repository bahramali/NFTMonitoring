import React from 'react';
import styles from './SuperAdminDashboard.module.css';

export default function SuperAdminDashboard() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1>Super Admin Dashboard</h1>
                <p>
                    You have full access. Use the Admin Management page to decide which routes each admin can open.
                </p>
                <ul className={styles.list}>
                    <li>Manage admins and their permissions.</li>
                    <li>Review quick links to admin-only tools.</li>
                    <li>Access any page regardless of role-specific checks.</li>
                </ul>
            </div>
        </div>
    );
}
