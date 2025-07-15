import React, { useEffect, useState } from 'react';

function StatusDot({ ok }) {
    return (
        <span
            style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: ok ? 'green' : 'red',
                marginLeft: 4,
            }}
        />
    );
}

function Header({ topic, temperature, humidity = 0, lux, health = {} }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header style={{ padding: '10px 20px', borderBottom: '1px solid #ccc', marginBottom: 20 }}>
            <h1 style={{ margin: 0 }}>🌿 AzadFarm Dashboard</h1>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>Time: {now.toLocaleTimeString()}</span>
                <span>Temp: {temperature.toFixed(1)}°C</span>
                <span>Humidity: {humidity.toFixed(1)}%</span>
                <span>Lux: {lux.toFixed(1)}</span>
                <span>Topic: {topic}</span>
                {Object.entries(health).map(([name, ok]) => (
                    <span key={name} style={{ display: 'flex', alignItems: 'center' }}>
                        {name}
                        <StatusDot ok={ok} />
                    </span>
                ))}
            </div>
        </header>
    );
}

export default React.memo(Header);
