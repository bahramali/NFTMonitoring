import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';

function Header({ title }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.time}>{now.toLocaleTimeString()}</div>
        </header>
    );
}

export default React.memo(Header);
