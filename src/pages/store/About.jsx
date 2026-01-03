import React from 'react';
import styles from './LegalPage.module.css';

export default function About() {
    return (
        <section className={styles.page}>
            <h1 className={styles.title}>About</h1>
            <p className={styles.text}>
                This is a placeholder page describing HydroLeaf&apos;s mission, values, and the team behind the store.
            </p>
        </section>
    );
}
