import React from 'react';
import idealRangeConfig from '../config/idealRangeConfig';

function Documentation() {
    return (
        <div>
            <h1>Ideal Ranges</h1>
            {Object.entries(idealRangeConfig).map(([key, value]) => (
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
