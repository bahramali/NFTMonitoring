import React from 'react';
import styles from './AdminPage.module.css';

export default function AdminReports() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1>Admin Reports</h1>
                <p>Use this space for admin-specific analytics. Access is permission controlled.</p>
            </div>
        </div>
    );
}
