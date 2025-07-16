import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';

function Header({ topic }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header className={styles.header}>
            <h1 className={styles.title}>{topic} Dashboard</h1>
            <div className={styles.time}>{now.toLocaleTimeString()}</div>
        </header>
    );
}

export default React.memo(Header);
