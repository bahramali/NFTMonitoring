import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';

function StatusDot({ ok }) {
    const className = `${styles.statusDot} ${ok ? styles.ok : styles.bad}`;
    return <span className={className} />;
}

function Header({ topic, temperature, humidity = 0, lux, health = {} }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header className={styles.header}>
            <h1 className={styles.title}>🌿 AzadFarm Dashboard</h1>
            <div className={styles.info}>
                <span>Time: {now.toLocaleTimeString()}</span>
                <span>Temp: {temperature.toFixed(1)}°C</span>
                <span>Humidity: {humidity.toFixed(1)}%</span>
                <span>Lux: {lux.toFixed(1)}</span>
                <span>Topic: {topic}</span>
                {Object.entries(health).map(([name, ok]) => (
                    <span key={name} className={styles.sensor}>
                        {name}
                        <StatusDot ok={ok} />
                    </span>
                ))}
            </div>
        </header>
    );
}

export default React.memo(Header);
