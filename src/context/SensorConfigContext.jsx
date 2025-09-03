import React, { createContext, useContext, useEffect, useState } from 'react';

const SensorConfigContext = createContext(null);

export function SensorConfigProvider({ children }) {
    const [configs, setConfigs] = useState({}); // { [key]: { key,minValue,maxValue,description } }
    const [error, setError] = useState('');

    useEffect(() => {
        loadConfigs();
    }, []);

    // GET all configs and normalize to a map
    async function loadConfigs() {
        try {
            setError('');
            const res = await fetch('/api/sensor-config', { method: 'GET' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const map = Array.isArray(data)
                ? data.reduce((m, x) => ((m[x.key] = x), m), {})
                : data || {};
            setConfigs(map);
        } catch (e) {
            setError(e.message || 'Failed to load sensor configs');
        }
    }

    // POST /api/sensor-config/{key}
    async function createConfig(key, payload) {
        const res = await fetch(`/api/sensor-config/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status}`);
        }
        const saved = await res.json(); // {key,minValue,maxValue,description}
        setConfigs((prev) => ({ ...prev, [saved.key]: saved }));
        return saved;
    }

    // PUT /api/sensor-config/{key}
    async function updateConfig(key, payload) {
        const res = await fetch(`/api/sensor-config/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status}`);
        }
        const saved = await res.json();
        setConfigs((prev) => ({ ...prev, [key]: saved }));
        return saved;
    }

    // DELETE /api/sensor-config/{key}
    async function deleteConfig(key) {
        const res = await fetch(`/api/sensor-config/${encodeURIComponent(key)}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status}`);
        }
        setConfigs((prev) => {
            const copy = { ...prev };
            delete copy[key];
            return copy;
        });
    }

    const value = {
        configs,
        error,
        reload: loadConfigs,
        createConfig,
        updateConfig,
        deleteConfig,
    };

    return (
        <SensorConfigContext.Provider value={value}>
            {children}
        </SensorConfigContext.Provider>
    );
}

export function useSensorConfig() {
    const ctx = useContext(SensorConfigContext);
    if (!ctx) throw new Error('useSensorConfig must be used inside SensorConfigProvider');
    return ctx;
}
