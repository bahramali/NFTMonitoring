import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AccessDenied.module.css';

export default function AccessDenied({ title = 'Access denied', message = 'You do not have permission to view this page.', actionHref = '/monitoring/overview', actionLabel = 'Back to monitoring', secondaryActionHref = '/login', secondaryActionLabel = 'Login again' }) {
    return (
        <div className={styles.wrapper}>
            <div className={styles.card} role="alert" aria-live="polite">
                <p className={styles.kicker}>Restricted</p>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.message}>{message}</p>
                <div className={styles.actions}>
                    {actionHref && (
                        <Link className={styles.primary} to={actionHref}>
                            {actionLabel}
                        </Link>
                    )}
                    {secondaryActionHref && (
                        <Link className={styles.secondary} to={secondaryActionHref}>
                            {secondaryActionLabel}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
