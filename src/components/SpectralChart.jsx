import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const SpectralChart = ({ data }) => {
    // تطبیق نام باندها به طول موج (nm)
    const bandToWavelength = {
        F1: 415,
        F2: 445,
        F3: 480,
        F4: 515,
        F5: 555,
        F6: 590,
        F7: 630,
        F8: 680,
        nir: 910,
        clear: 0 // این یکی معمولاً مرجع است و نمایش داده نمی‌شود یا متفاوت بررسی می‌شود
    };

    const filteredData = data
        .filter(d => bandToWavelength[d.band] !== undefined && d.band !== 'clear')
        .map(d => ({
            wavelength: bandToWavelength[d.band],
            intensity: d.intensity
        }));

    return (
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
                <BarChart data={filteredData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="wavelength" label={{ value: 'طول موج (nm)', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'شدت نور (PPFD)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="intensity" fill="#82ca9d" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SpectralChart;