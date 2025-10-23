import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    getSensorConfigs,
    createSensorConfig,
    updateSensorConfig,
    deleteSensorConfig,
} from '../api/sensorConfig.js';

const Ctx = createContext(null);

const TOPIC_DELIM = '@@';

const sanitize = (value) => (value == null ? '' : String(value).trim());
const canon = (value) => sanitize(value).toLowerCase();

const encodeKey = (sensorType, topic) => {
    const base = sanitize(sensorType);
    const topicPart = sanitize(topic);
    return topicPart ? `${base}${TOPIC_DELIM}${topicPart}` : base;
};

const decodeKey = (key) => {
    const safeKey = sanitize(key);
    if (!safeKey) return { sensorType: '', topic: '' };
    const idx = safeKey.indexOf(TOPIC_DELIM);
    if (idx === -1) return { sensorType: safeKey, topic: '' };
    return {
        sensorType: safeKey.slice(0, idx),
        topic: safeKey.slice(idx + TOPIC_DELIM.length),
    };
};

const toNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
};

function normalizeConfig(raw) {
    const rawKey = raw?.sensorType ?? raw?.sensor_type;
    if (!rawKey) return null;

    const decoded = decodeKey(rawKey);
    const sensorType = sanitize(
        raw?.baseSensorType ?? raw?.metric ?? raw?.type ?? decoded.sensorType ?? rawKey,
    );
    const topic = sanitize(raw?.topic ?? raw?.topicName ?? raw?.topic_key ?? decoded.topic ?? '');

    const min = toNumber(raw?.idealRange?.min ?? raw?.min ?? raw?.minValue ?? raw?.min_value);
    const max = toNumber(raw?.idealRange?.max ?? raw?.max ?? raw?.maxValue ?? raw?.max_value);

    const idealRange =
        min !== undefined || max !== undefined
            ? { min, max }
            : raw?.idealRange;

    const id = encodeKey(sensorType, topic);

    return {
        ...raw,
        id,
        key: id,
        rawKey,
        sensorType,
        topic,
        canonicalType: canon(sensorType || rawKey),
        canonicalTopic: canon(topic),
        minValue: min,
        maxValue: max,
        description: raw?.description ?? '',
        idealRange,
    };
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
                if (cfg) m[cfg.id] = cfg;
                return m;
            }, {});
            setConfigs(map);
        } catch (e) { setError(e.message || 'Failed to load sensor configs'); }
    }

    async function createConfig({ sensorType, topic, minValue, maxValue, description }) {
        try {
            setError('');
            const encodedKey = encodeKey(sensorType, topic);
            const saved = normalizeConfig(
                await createSensorConfig({
                    sensorType: encodedKey,
                    topic: sanitize(topic) || undefined,
                    minValue: toNumber(minValue),
                    maxValue: toNumber(maxValue),
                    description: description ?? '',
                })
            );
            const key = saved?.id ?? encodedKey;
            setConfigs(prev => ({ ...prev, [key]: saved }));
            return saved;
        } catch (e) {
            setError(e.message || 'Failed to create sensor config');
            throw e;
        }
    }

    async function updateConfig(id, payload) {
        try {
            setError('');
            const current = configs[id];
            const body = {
                ...payload,
                minValue: toNumber(payload?.minValue),
                maxValue: toNumber(payload?.maxValue),
                description: payload?.description ?? '',
            };
            if (current?.topic) {
                body.topic = current.topic;
            }
            const saved = normalizeConfig(
                await updateSensorConfig(id, body)
            );
            const key = saved?.id ?? id;
            setConfigs(prev => ({ ...prev, [key]: saved }));
            return saved;
        } catch (e) {
            setError(e.message || 'Failed to update sensor config');
            throw e;
        }
    }

    async function deleteConfig(id) {
        try {
            setError('');
            await deleteSensorConfig(id);
            setConfigs(prev => { const c = { ...prev }; delete c[id]; return c; });
        } catch (e) {
            setError(e.message || 'Failed to delete sensor config');
            throw e;
        }
    }

    const lookup = useMemo(() => {
        const byType = {};
        Object.values(configs).forEach((cfg) => {
            if (!cfg?.canonicalType) return;
            const entry = byType[cfg.canonicalType] ?? { default: null, byTopic: {} };
            if (cfg.canonicalTopic) {
                entry.byTopic[cfg.canonicalTopic] = cfg;
            } else {
                entry.default = cfg;
            }
            byType[cfg.canonicalType] = entry;
        });
        return byType;
    }, [configs]);

    const findConfig = useCallback((sensorType, options = {}) => {
        const typeKey = canon(sensorType);
        if (!typeKey) return null;
        const entry = lookup[typeKey];
        if (!entry) return null;
        const topicKey = canon(options.topic);
        if (topicKey && entry.byTopic[topicKey]) {
            return entry.byTopic[topicKey];
        }
        return entry.default ?? null;
    }, [lookup]);

    const findRange = useCallback((sensorType, options = {}) => {
        const cfg = findConfig(sensorType, options);
        return cfg?.idealRange ?? null;
    }, [findConfig]);

    return (
        <Ctx.Provider
            value={{
                configs,
                error,
                reload: loadConfigs,
                createConfig,
                updateConfig,
                deleteConfig,
                findConfig,
                findRange,
            }}
        >
            {children}
        </Ctx.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSensorConfig() {
    const v = useContext(Ctx);
    if (!v) throw new Error('useSensorConfig must be used inside SensorConfigProvider');
    return v;
}
