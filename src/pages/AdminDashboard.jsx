import React from 'react';
import styles from './AdminPage.module.css';

export default function AdminDashboard() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1>Admin Overview</h1>
                <p>Admins only see this if the super admin assigns the "Admin Overview" permission.</p>
            </div>
        </div>
    );
}
