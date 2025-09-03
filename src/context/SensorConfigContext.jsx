import React, { createContext, useContext, useEffect, useState } from 'react';

const noop = async () => {};

const SensorConfigContext = createContext({
    configs: {},
    error: null,
    reload: noop,
    createConfig: noop,
    updateConfig: noop,
    deleteConfig: noop,
});

export function SensorConfigProvider({ children }) {
    const [configs, setConfigs] = useState({});
    const [error, setError] = useState(null);

    const reload = async () => {
        try {
            setError(null);
            const res = await fetch('/api/sensor-config');
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
            const res = await fetch('/api/sensor-config', {
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
            const res = await fetch(`/api/sensor-config/${key}`, {
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
            const res = await fetch(`/api/sensor-config/${key}`, { method: 'DELETE' });
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

// eslint-disable-next-line react-refresh/only-export-components
export function useSensorConfig() {
    return useContext(SensorConfigContext);
}
