import React from 'react';
import { useSensorConfig } from '../../context/SensorConfigContext.jsx';

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
            <h1>Ideal Ranges</h1>
            {Object.entries(configs).map(([key, value]) => (
                <section key={key}>
                    <h2>{key}</h2>
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
