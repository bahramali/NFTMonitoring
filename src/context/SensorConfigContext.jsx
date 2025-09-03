import React, { createContext, useContext, useEffect, useState } from 'react';

// Default sensor configuration copied from previous static mapping
const defaultConfigs = {
    temperature: {
        idealRange: { min: 20, max: 30 },
        description: 'Ideal range for basil growth is 20–30°C. Below 18°C or above 32°C may slow growth.'
    },
    humidity: {
        idealRange: { min: 50, max: 70 },
        description: 'Best humidity for basil is between 50% and 70%. Too dry or too wet affects leaf quality.'
    },
    lux: {
        idealRange: { min: 800, max: 2000 },
        description: 'Basil needs strong light. 800–2000 lux is ideal for indoor growth.'
    },
    tds: {
        idealRange: { min: 700, max: 1200 },
        description: 'TDS level shows nutrient concentration. Below 600 = weak; above 1400 = overfed.'
    },
    ec: {
        idealRange: { min: 1.1, max: 1.8 },
        description: 'EC is based on TDS. 1.1–1.8 mS/cm is ideal for basil in hydroponics.'
    },
    ph: {
        idealRange: { min: 5.8, max: 6.5 },
        description: 'pH affects nutrient absorption. 6.0 is optimal for basil.'
    },
    do: {
        idealRange: { min: 5, max: 8 },
        description: 'Dissolved oxygen ideal range is roughly 5–8 mg/L.'
    },
    dissolvedOxygen: {
        idealRange: { min: 5, max: 8 },
        description: 'Dissolved oxygen ideal range is roughly 5–8 mg/L.'
    },
    '415nm': {
        idealRange: { min: 2, max: 50 },
        description: 'Supports early cell growth.',
        spectralRange: '400–430 nm',
        color: 'Violet'
    },
    '445nm': {
        idealRange: { min: 80, max: 200 },
        description: 'Key for chlorophyll and leafy growth.',
        spectralRange: '430–460 nm',
        color: 'Blue'
    },
    '480nm': {
        idealRange: { min: 70, max: 180 },
        description: 'Blue-green light; supports vegetative growth and pigment production.',
        spectralRange: '460–500 nm',
        color: 'Cyan'
    },
    '515nm': {
        idealRange: { min: 40, max: 150 },
        description: 'Green light; penetrates deeper into leaves and regulates growth balance.',
        spectralRange: '500–530 nm',
        color: 'Green'
    },
    '555nm': {
        idealRange: { min: 80, max: 200 },
        description: 'Mid-green light; complements blue and red for fuller spectrum balance.',
        spectralRange: '530–570 nm',
        color: 'Green/Yellow'
    },
    '590nm': {
        idealRange: { min: 50, max: 140 },
        description: 'Yellow light; minor effect on photosynthesis but supports photomorphogenesis.',
        spectralRange: '570–610 nm',
        color: 'Yellow/Orange'
    },
    '630nm': {
        idealRange: { min: 120, max: 300 },
        description: 'Helps in flowering and general development.',
        spectralRange: '610–650 nm',
        color: 'Orange/Red'
    },
    '680nm': {
        idealRange: { min: 130, max: 320 },
        description: 'Peak light absorption for photosynthesis.',
        spectralRange: '650–700 nm',
        color: 'Red'
    },
    clear: {
        idealRange: { min: 300, max: 900 },
        description: 'Total visible light intensity. General index of light.',
        spectralRange: 'full visible spectrum',
        color: 'All colors'
    },
    nir: {
        idealRange: { min: 20, max: 100 },
        description: 'Higher NIR may indicate heat. Keep it low indoors.',
        spectralRange: '>700 nm',
        color: 'Near Infrared'
    }
};

const noop = async () => {};

const SensorConfigContext = createContext({
    configs: defaultConfigs,
    error: null,
    reload: noop,
    createConfig: noop,
    updateConfig: noop,
    deleteConfig: noop,
});

export function SensorConfigProvider({ children }) {
    const [configs, setConfigs] = useState(defaultConfigs);
    const [error, setError] = useState(null);

    const reload = async () => {
        try {
            setError(null);
            const res = await fetch('/api/sensor-configs');
            if (!res.ok) throw new Error('Failed to load configs');
            const data = await res.json();
            setConfigs(data);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        reload();
    }, []);

    const createConfig = async (key, cfg) => {
        if (!key || !cfg?.idealRange) {
            setError('Invalid config');
            return;
        }
        try {
            setError(null);
            const res = await fetch('/api/sensor-configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, ...cfg })
            });
            if (!res.ok) throw new Error('Failed to create config');
            const saved = await res.json();
            setConfigs(prev => ({ ...prev, [key]: saved }));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const updateConfig = async (key, cfg) => {
        if (!key || !cfg) {
            setError('Invalid config');
            return;
        }
        try {
            setError(null);
            const res = await fetch(`/api/sensor-configs/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cfg)
            });
            if (!res.ok) throw new Error('Failed to update config');
            const saved = await res.json();
            setConfigs(prev => ({ ...prev, [key]: saved }));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const deleteConfig = async (key) => {
        try {
            setError(null);
            const res = await fetch(`/api/sensor-configs/${key}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete config');
            setConfigs(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const value = { configs, error, reload, createConfig, updateConfig, deleteConfig };

    return (
        <SensorConfigContext.Provider value={value}>
            {children}
        </SensorConfigContext.Provider>
    );
}

export function useSensorConfig() {
    return useContext(SensorConfigContext);
}

export default SensorConfigContext;
