import React from 'react';
import { Link } from 'react-router-dom';
import styles from './NotAuthorized.module.css';

export default function NotAuthorized() {
    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1>Not authorized</h1>
                <p>You tried to open a page that your role or permissions do not allow.</p>
                <div className={styles.actions}>
                    <Link to="/store" className={styles.button}>Go to Store</Link>
                    <Link to="/login" className={styles.secondary}>Login again</Link>
                </div>
            </div>
        </div>
    );
}
