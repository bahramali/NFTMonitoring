import React from 'react';
import styles from './AccountCard.module.css';

export default function AccountCard({ title, subtitle, action, children, className = '' }) {
    return (
        <section className={`${styles.card} ${className}`}>
            <header className={styles.header}>
                <div>
                    <h2>{title}</h2>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
                {action || null}
            </header>
            <div className={styles.body}>{children}</div>
        </section>
    );
}
