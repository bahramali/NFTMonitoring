import React from 'react';
import { useSensorConfig } from '../../context/SensorConfigContext.jsx';
import Header from "../common/Header";

function Documentation() {
    const { configs, error, loading } = useSensorConfig();

    const entries = Object.values(configs || {});

    if (loading) {
        return <div>Loading configurations...</div>;
    }

    if (error) {
        return <div role="alert">{error}</div>;
    }

    if (!entries || entries.length === 0) {
        return <div>No configurations found</div>;
    }

    return (
        <div>
            <Header title="Documentation" />
            <h2>Ideal Ranges</h2>
            {entries.map((cfg) => (
                <section key={cfg.id}>
                    <h3>
                        {cfg.sensorType}
                        <span style={{ fontWeight: 400, fontSize: "0.9em" }}>
                            {cfg.topic ? ` — ${cfg.topic}` : " — All topics"}
                        </span>
                    </h3>
                    <p>{cfg.description}</p>
                    {cfg.idealRange && (
                        <p>
                            Ideal range: {cfg.idealRange.min}–{cfg.idealRange.max}
                        </p>
                    )}
                    {cfg.spectralRange && (
                        <p>Spectral range: {cfg.spectralRange}</p>
                    )}
                    {cfg.color && <p>Color: {cfg.color}</p>}
                </section>
            ))}
        </div>
    );
}

export default Documentation;
