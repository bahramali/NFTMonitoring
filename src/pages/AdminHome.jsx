import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AdminHome.module.css';

const QUICK_ACTIONS = [
    {
        title: 'Invite Admin',
        description: 'Send a new invite and assign permissions.',
        to: '/admin/directory',
        tone: 'primary',
    },
    {
        title: 'Manage Permissions',
        description: 'Review admin access levels and roles.',
        to: '/admin/directory',
        tone: 'secondary',
    },
    {
        title: 'Create Product',
        description: 'Add a new store product for customers.',
        to: '/store/admin/products',
        tone: 'secondary',
    },
    {
        title: 'View System Health',
        description: 'Jump into the monitoring overview.',
        to: '/monitoring/overview',
        tone: 'ghost',
    },
];

export default function AdminHome() {
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Admin</p>
                    <h1 className={styles.title}>Super Admin Home</h1>
                    <p className={styles.subtitle}>
                        Manage the HydroLeaf platform from one place. Use the quick actions below to jump into the
                        highest-impact workflows.
                    </p>
                </div>
                <div className={styles.badge}>SUPER_ADMIN</div>
            </header>

            <section className={styles.actions}>
                {QUICK_ACTIONS.map((action) => (
                    <Link key={action.title} to={action.to} className={`${styles.card} ${styles[action.tone]}`}>
                        <div>
                            <h2>{action.title}</h2>
                            <p>{action.description}</p>
                        </div>
                        <span className={styles.cta}>Open →</span>
                    </Link>
                ))}
            </section>
        </div>
    );
}
