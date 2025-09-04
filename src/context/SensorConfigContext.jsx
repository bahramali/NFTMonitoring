import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    getSensorConfigs,
    createSensorConfig,
    updateSensorConfig,
    deleteSensorConfig,
} from '../api/sensorConfig.js';

const Ctx = createContext(null);

function normalizeConfig(raw) {
    const key = raw?.sensorType ?? raw?.sensor_type;
    if (!key) return null;
    const min = raw?.idealRange?.min ?? raw?.min ?? raw?.minValue ?? raw?.min_value;
    const max = raw?.idealRange?.max ?? raw?.max ?? raw?.maxValue ?? raw?.max_value;
    const idealRange =
        raw?.idealRange ||
        (min !== undefined || max !== undefined ? { min, max } : undefined);
    return { ...raw, sensorType: key, idealRange };
}

export function SensorConfigProvider({ children }) {
    const [configs, setConfigs] = useState({});
    const [error, setError] = useState('');

    useEffect(() => { loadConfigs(); }, []);

    async function loadConfigs() {
        try {
            setError('');
            const data = await getSensorConfigs();
            const map = (Array.isArray(data) ? data : []).reduce((m, x) => {
                const cfg = normalizeConfig(x);
                if (cfg) m[cfg.sensorType] = cfg;
                return m;
            }, {});
            setConfigs(map);
        } catch (e) { setError(e.message || 'Failed to load sensor configs'); }
    }

    async function createConfig(sensorType, payload) {
        try {
            setError('');
            const saved = normalizeConfig(
                await createSensorConfig({ sensorType, ...payload })
            );
            const key = saved?.sensorType ?? sensorType;
            setConfigs(prev => ({ ...prev, [key]: saved }));
            return saved;
        } catch (e) {
            setError(e.message || 'Failed to create sensor config');
            throw e;
        }
    }

    async function updateConfig(sensorType, payload) {
        try {
            setError('');
            const saved = normalizeConfig(
                await updateSensorConfig(sensorType, payload)
            );
            const key = saved?.sensorType ?? sensorType;
            setConfigs(prev => ({ ...prev, [key]: saved }));
            return saved;
        } catch (e) {
            setError(e.message || 'Failed to update sensor config');
            throw e;
        }
    }

    async function deleteConfig(sensorType) {
        try {
            setError('');
            await deleteSensorConfig(sensorType);
            setConfigs(prev => { const c = { ...prev }; delete c[sensorType]; return c; });
        } catch (e) {
            setError(e.message || 'Failed to delete sensor config');
            throw e;
        }
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
