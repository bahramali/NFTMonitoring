import React from 'react';
import styles from './AdminPage.module.css';

export default function AdminTeam() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1>Admin Team</h1>
                <p>Coordinate admin-only tasks with the permissions granted by the super admin.</p>
            </div>
        </div>
    );
}
