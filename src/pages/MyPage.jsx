import React from 'react';
import styles from './MyPage.module.css';
import { useAuth } from '../context/AuthContext.jsx';

export default function MyPage() {
    const { userId } = useAuth();

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1>My Page</h1>
                <p>Welcome back, {userId || 'customer'}.</p>
                <p className={styles.subtitle}>Only content for the logged-in customer appears here.</p>
                <ul className={styles.list}>
                    <li>Order status and delivery windows.</li>
                    <li>Saved packaging preferences.</li>
                    <li>Direct link back to the public store.</li>
                </ul>
            </div>
        </div>
    );
}
