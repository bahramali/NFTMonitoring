import React, { useEffect, useState } from 'react';

function Header({ topic, temperature }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header style={{ marginBottom: 20 }}>
            <div>Time: {now.toLocaleTimeString()}</div>
            <div>Topic: {topic}</div>
            <div>Temperature: {temperature.toFixed(1)}°C</div>
        </header>
    );
}

export default React.memo(Header);
