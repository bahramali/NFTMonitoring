import React from 'react';
import styles from './LegalPage.module.css';

export default function FAQ() {
    return (
        <section className={styles.page}>
            <h1 className={styles.title}>FAQ</h1>
            <p className={styles.text}>
                This is a placeholder FAQ page. Add common questions about ordering, payment, and pickup here.
            </p>
        </section>
    );
}
