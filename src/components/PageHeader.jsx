import React from 'react';
import { Link } from 'react-router-dom';
import styles from './PageHeader.module.css';

const TONE_CLASS = {
    online: styles.statusOnline,
    offline: styles.statusOffline,
    reconnecting: styles.statusReconnecting,
};

export default function PageHeader({
    breadcrumbItems = [],
    title,
    status,
    actions = [],
    variant = 'light',
}) {
    const headerClassName = [
        styles.header,
        variant === 'dark' ? styles.dark : styles.light,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <header className={headerClassName}>
            <div className={styles.content}>
                {breadcrumbItems.length > 0 && (
                    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                        <ol>
                            {breadcrumbItems.map((item, index) => {
                                const isLast = index === breadcrumbItems.length - 1;
                                return (
                                    <li key={`${item.label}-${index}`}>
                                        {item.to && !isLast ? (
                                            <Link to={item.to}>{item.label}</Link>
                                        ) : (
                                            <span aria-current={isLast ? 'page' : undefined}>
                                                {item.label}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    </nav>
                )}
                <div className={styles.titleRow}>
                    <h1 className={styles.title}>{title}</h1>
                    {status?.label && (
                        <span
                            className={`${styles.statusPill} ${
                                TONE_CLASS[status.tone] || styles.statusNeutral
                            }`}
                        >
                            {status.label}
                        </span>
                    )}
                </div>
            </div>
            {actions.length > 0 && (
                <div className={styles.actions}>
                    {actions.map((action) => {
                        const className = [
                            styles.actionButton,
                            action.variant === 'ghost' ? styles.actionGhost : styles.actionPrimary,
                        ]
                            .filter(Boolean)
                            .join(' ');
                        if (action.to) {
                            return (
                                <Link
                                    key={action.label}
                                    to={action.to}
                                    className={className}
                                >
                                    {action.label}
                                </Link>
                            );
                        }
                        return (
                            <button
                                key={action.label}
                                type="button"
                                className={className}
                                onClick={action.onClick}
                                disabled={action.disabled}
                            >
                                {action.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </header>
    );
}
