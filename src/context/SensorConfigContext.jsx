import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    getSensorConfigs,
    createSensorConfig,
    updateSensorConfig,
    deleteSensorConfig,
} from '../api/sensorConfig.js';

const Ctx = createContext(null);

export function SensorConfigProvider({ children }) {
    const [configs, setConfigs] = useState({});
    const [error, setError] = useState('');

    useEffect(() => { loadConfigs(); }, []);

    async function loadConfigs() {
        try {
            setError('');
            const data = await getSensorConfigs();
            const map = (Array.isArray(data) ? data : []).reduce((m, x) => {
                const key = x.sensorType ?? x.sensor_type;
                if (key) m[key] = { ...x, sensorType: key };
                return m;
            }, {});
            setConfigs(map);
        } catch (e) { setError(e.message || 'Failed to load sensor configs'); }
    }

    async function createConfig(sensorType, payload) {
        try {
            setError('');
            const saved = await createSensorConfig({ sensorType, ...payload });
            const key = saved.sensorType ?? saved.sensor_type ?? sensorType;
            setConfigs(prev => ({ ...prev, [key]: { ...saved, sensorType: key } }));
            return saved;
        } catch (e) {
            setError(e.message || 'Failed to create sensor config');
            throw e;
        }
    }

    async function updateConfig(sensorType, payload) {
        try {
            setError('');
            const saved = await updateSensorConfig(sensorType, payload);
            const key = saved.sensorType ?? saved.sensor_type ?? sensorType;
            setConfigs(prev => ({ ...prev, [key]: { ...saved, sensorType: key } }));
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
