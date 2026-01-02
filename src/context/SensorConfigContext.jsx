import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    getSensorConfigs,
    createSensorConfig,
    updateSensorConfig,
    deleteSensorConfig,
} from '../api/sensorConfig.js';
import { getMetricLiveLabel } from '../config/sensorMetrics.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext(null);

const TOPIC_DELIM = '@@';

const sanitize = (value) => (value == null ? '' : String(value).trim());
const canon = (value) => sanitize(value).toLowerCase();
const canonLabel = (value) => (value == null ? '' : String(value).toLowerCase().replace(/[^a-z0-9]/g, ''));

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

export function SensorConfigProvider({ children, locationPath }) {
    const [configs, setConfigs] = useState({});
    const [error, setError] = useState('');
    const { isAuthenticated } = useAuth();

    const loadConfigs = useCallback(async () => {
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
    }, []);

    const pathname = locationPath ?? (typeof window !== 'undefined' ? window.location?.pathname : '');
    const isMonitoringRoute = pathname.startsWith('/monitoring');
    const shouldLoadConfigs = isAuthenticated && isMonitoringRoute;

    useEffect(() => {
        if (!shouldLoadConfigs) {
            setConfigs({});
            setError('');
            return;
        }
        loadConfigs();
    }, [loadConfigs, shouldLoadConfigs]);

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

    const labelLookup = useMemo(() => {
        const byTopic = {};
        const global = {};

        Object.values(configs).forEach((cfg) => {
            if (!cfg?.sensorType) return;
            const topicKey = cfg.canonicalTopic;
            const label = getMetricLiveLabel(cfg.sensorType, { topic: cfg.topic }) || cfg.sensorType;
            const labelKey = canonLabel(label);
            if (!labelKey) return;

            if (topicKey) {
                const entry = byTopic[topicKey] ?? {};
                if (!entry[labelKey]) entry[labelKey] = cfg;
                byTopic[topicKey] = entry;
            } else if (!global[labelKey]) {
                global[labelKey] = cfg;
            }
        });

        return { byTopic, global };
    }, [configs]);

    const findConfig = useCallback((sensorType, options = {}) => {
        const topicKey = canon(options.topic);
        const metricKey = canon(options.metric);

        if (metricKey) {
            const metricEntry = lookup[metricKey];
            if (metricEntry) {
                if (topicKey && metricEntry.byTopic[topicKey]) {
                    return metricEntry.byTopic[topicKey];
                }
                if (metricEntry.default) {
                    return metricEntry.default;
                }
            }
        }

        const typeKey = canon(sensorType);
        if (typeKey) {
            const entry = lookup[typeKey];
            if (entry) {
                if (topicKey && entry.byTopic[topicKey]) {
                    return entry.byTopic[topicKey];
                }
                if (entry.default) {
                    return entry.default;
                }
            }
        }

        const labels = new Set();
        if (options.label) {
            labels.add(canonLabel(options.label));
        }
        if (options.metric) {
            labels.add(canonLabel(getMetricLiveLabel(options.metric, { topic: options.topic })));
        }
        labels.add(canonLabel(getMetricLiveLabel(sensorType, { sensorModel: options.sensorModel, topic: options.topic })));

        for (const labelKey of labels) {
            if (!labelKey) continue;
            if (topicKey && labelLookup.byTopic[topicKey]?.[labelKey]) {
                return labelLookup.byTopic[topicKey][labelKey];
            }
            if (labelLookup.global[labelKey]) {
                return labelLookup.global[labelKey];
            }
        }

        return null;
    }, [labelLookup, lookup]);

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
