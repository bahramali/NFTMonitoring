import React from 'react';
import styles from './AdminPage.module.css';

export default function AdminDashboard() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1>Admin Dashboard</h1>
                <p>Admins only see this if the super admin assigns the "Admin Dashboard" permission.</p>
            </div>
        </div>
    );
}
