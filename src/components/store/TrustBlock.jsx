import React from 'react';
import styles from './TrustBlock.module.css';

export default function TrustBlock({ companyName, contactLine, storageLine, originLabel }) {
    return (
        <section className={styles.block} aria-label="Trust and handling details">
            <div className={styles.header}>
                <p className={styles.kicker}>Trust</p>
                <span className={styles.origin}>{originLabel}</span>
            </div>
            <div className={styles.body}>
                <div>
                    <p className={styles.label}>Producer</p>
                    <p className={styles.value}>{companyName}</p>
                </div>
                <div>
                    <p className={styles.label}>Contact</p>
                    <p className={styles.value}>{contactLine}</p>
                </div>
                <div>
                    <p className={styles.label}>Storage</p>
                    <p className={styles.value}>{storageLine}</p>
                </div>
            </div>
        </section>
    );
}
