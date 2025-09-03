import React, { createContext, useContext, useEffect, useState } from 'react';

const Ctx = createContext(null);

// Base URL for REST API requests. Falls back to the public API if the
// environment variable is not provided.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.hydroleaf.se';

export function SensorConfigProvider({ children }) {
    const [configs, setConfigs] = useState({});
    const [error, setError] = useState('');

    useEffect(() => { loadConfigs(); }, []);

    async function safeError(res) {
        try { return await res.text(); } catch { return `HTTP ${res.status}`; }
    }

    async function loadConfigs() {
        try {
            setError('');
            const res = await fetch(`${API_BASE}/api/sensor-config`);
            if (!res.ok) throw new Error(await safeError(res));
            const data = await res.json();
            const map = (Array.isArray(data) ? data : []).reduce((m, x) => (m[x.key] = x, m), {});
            setConfigs(map);
        } catch (e) { setError(e.message || 'Failed to load sensor configs'); }
    }

    async function createConfig(key, payload) {
        const res = await fetch(`${API_BASE}/api/sensor-config/${encodeURIComponent(key)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await safeError(res));
        const saved = await res.json();
        setConfigs(prev => ({ ...prev, [saved.key]: saved }));
        return saved;
    }

    async function updateConfig(key, payload) {
        const res = await fetch(`${API_BASE}/api/sensor-config/${encodeURIComponent(key)}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await safeError(res));
        const saved = await res.json();
        setConfigs(prev => ({ ...prev, [key]: saved }));
        return saved;
    }

    async function deleteConfig(key) {
        const res = await fetch(`${API_BASE}/api/sensor-config/${encodeURIComponent(key)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await safeError(res));
        setConfigs(prev => { const c = { ...prev }; delete c[key]; return c; });
    }

    return (
        <Ctx.Provider value={{ configs, error, reload: loadConfigs, createConfig, updateConfig, deleteConfig }}>
            {children}
        </Ctx.Provider>
    );
}

export function useSensorConfig() {
    const v = useContext(Ctx);
    if (!v) throw new Error('useSensorConfig must be used inside SensorConfigProvider');
    return v;
}
