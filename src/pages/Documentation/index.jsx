import React from 'react';
import { useSensorConfig } from '../../context/SensorConfigContext.jsx';
import Header from "../common/Header";

function Documentation() {
    const { configs, error, loading } = useSensorConfig();

    if (loading) {
        return <div>Loading configurations...</div>;
    }

    if (error) {
        return <div role="alert">{error}</div>;
    }

    if (!configs || Object.keys(configs).length === 0) {
        return <div>No configurations found</div>;
    }

    return (
        <div>
            <Header title="Documentation" />
            <h2>Ideal Ranges</h2>
            {Object.entries(configs).map(([key, value]) => (
                <section key={key}>
                    <h3>{key}</h3>
                    <p>{value.description}</p>
                    {value.idealRange && (
                        <p>
                            Ideal range: {value.idealRange.min}–{value.idealRange.max}
                        </p>
                    )}
                    {value.spectralRange && (
                        <p>Spectral range: {value.spectralRange}</p>
                    )}
                    {value.color && <p>Color: {value.color}</p>}
                </section>
            ))}
        </div>
    );
}

export default Documentation;
