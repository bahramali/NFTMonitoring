import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSensorConfigs, createSensorConfig, updateSensorConfig, deleteSensorConfig } from '../api/sensorConfig.js';

const SensorConfigContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useSensorConfig = () => useContext(SensorConfigContext);

export function SensorConfigProvider({ children, initialConfigs }) {
    const [configs, setConfigs] = useState(initialConfigs || {});

    const loadConfigs = useCallback(async () => {
        try {
            const data = await getSensorConfigs();
            setConfigs(data || {});
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        if (initialConfigs) return;
        loadConfigs();
    }, [initialConfigs, loadConfigs]);

    const createConfig = useCallback(async (data) => {
        const res = await createSensorConfig(data);
        const key = res?.sensorType || data?.sensorType;
        if (key) {
            setConfigs(prev => ({ ...prev, [key]: res }));
        }
        return res;
    }, []);

    const updateConfig = useCallback(async (sensorType, data) => {
        const res = await updateSensorConfig(sensorType, data);
        setConfigs(prev => ({ ...prev, [sensorType]: res }));
        return res;
    }, []);

    const removeConfig = useCallback(async (sensorType) => {
        await deleteSensorConfig(sensorType);
        setConfigs(prev => {
            const next = { ...prev };
            delete next[sensorType];
            return next;
        });
    }, []);

    const value = {
        sensorConfigs: configs,
        reloadConfigs: loadConfigs,
        createConfig,
        updateConfig,
        deleteConfig: removeConfig,
    };

    return (
        <SensorConfigContext.Provider value={value}>
            {children}
        </SensorConfigContext.Provider>
    );
}
