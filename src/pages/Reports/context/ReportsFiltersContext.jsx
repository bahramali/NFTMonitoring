import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useLocation } from "react-router-dom";
import { fetchDeviceCatalog } from "../utils/catalog";
import { pickBucket, toISOSeconds, toLocalInputValue } from "../utils/datetime";
import { fetchTopicSensors } from "../../../api/topics.js";
import { ensureString } from "../utils/strings";
import { buildDeviceKey } from "../../../utils/deviceIdentity.js";

const ReportsFiltersContext = createContext(null);

const DEFAULT_REPORT_TOPICS = ["growSensors", "germinationTopic", "waterTank"];

const formatTopicLabel = (id) =>
    String(id || "")
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/^\s+|\s+$/g, "")
        .replace(/^./, (ch) => ch.toUpperCase());

const normalizeSensorKey = (value) =>
    ensureString(value).toLowerCase().replace(/[\s._-]/g, "");

const resolveLayerId = (device) =>
    ensureString(device?.layerId, device?.layer?.id, device?.layer);

const shouldIncludeDeviceForTopic = (topic, device) => {
    if (!topic || !device) return false;
    if (topic === "growSensors") {
        return !!resolveLayerId(device);
    }
    return true;
};

const dedupeTopics = (defaults, apiTopics) => {
    const seen = new Set();
    const ordered = [];
    const add = (topic) => {
        const id = ensureString(topic);
        if (!id || seen.has(id)) return;
        seen.add(id);
        ordered.push(id);
    };
    defaults.forEach(add);
    apiTopics.forEach(add);
    if (ordered.length) {
        return ordered;
    }
    return defaults.slice();
};

const createSensorSelectionState = (topics, source = {}) => {
    const next = {};
    topics.forEach((topic) => {
        const existing = source[topic];
        if (existing instanceof Set) {
            next[topic] = new Set(existing);
        } else if (Array.isArray(existing)) {
            next[topic] = new Set(existing);
        } else {
            next[topic] = new Set();
        }
    });
    return next;
};

const toggleValue = (values, value) => {
    if (values.includes(value)) {
        return values.filter((v) => v !== value);
    }
    return [...values, value];
};

const buildTopicSensorMap = (topics, apiTopicSensors, deviceRows) => {
    const sensorsByTopic = new Map();
    topics.forEach((topic) => {
        sensorsByTopic.set(topic, new Map());
    });

    const registerSensor = (topicMap, topic, rawLabel) => {
        const label = ensureString(rawLabel);
        const normalized = normalizeSensorKey(label);
        if (!label || !normalized) return { added: false, normalized: false };
        if (!topicMap.has(normalized)) {
            topicMap.set(normalized, {
                id: label,
                label,
                topic,
            });
            return { added: true, normalized: true };
        }
        return { added: false, normalized: true };
    };

    (deviceRows || []).forEach((device) => {
        const sensors = Array.isArray(device?.sensors) ? device.sensors : [];
        if (!sensors.length) return;
        topics.forEach((topic) => {
            if (!shouldIncludeDeviceForTopic(topic, device)) return;
            if (!sensorsByTopic.has(topic)) {
                sensorsByTopic.set(topic, new Map());
            }
            const topicMap = sensorsByTopic.get(topic);
            let hasNormalized = false;
            sensors.forEach((sensor) => {
                const rawLabel =
                    ensureString(sensor?.sensorType) ||
                    ensureString(sensor?.valueType) ||
                    ensureString(sensor?.sensorName) ||
                    ensureString(sensor?.name) ||
                    ensureString(sensor);
                const { normalized } = registerSensor(topicMap, topic, rawLabel);
                if (normalized) {
                    hasNormalized = true;
                }
            });
            if (!hasNormalized) {
                console.warn("Reports: sensors empty after normalization", {
                    deviceId: ensureString(device?.deviceId, device?.deviceKey),
                    sensors,
                });
            }
        });
    });

    Object.entries(apiTopicSensors || {}).forEach(([topic, sensors]) => {
        if (!sensorsByTopic.has(topic)) {
            sensorsByTopic.set(topic, new Map());
        }
        const topicMap = sensorsByTopic.get(topic);
        (sensors || []).forEach((sensor) => {
            const rawLabel = ensureString(sensor?.label, sensor?.id, sensor);
            registerSensor(topicMap, topic, rawLabel);
        });
    });

    const result = {};
    sensorsByTopic.forEach((topicMap, topic) => {
        result[topic] = Array.from(topicMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    });
    return result;
};

const buildTopicDeviceMap = (topics, deviceRows) => {
    const devicesByTopic = new Map();
    topics.forEach((topic) => {
        devicesByTopic.set(topic, new Map());
    });

    (deviceRows || []).forEach((device) => {
        topics.forEach((topic) => {
            if (!shouldIncludeDeviceForTopic(topic, device)) return;
            if (!devicesByTopic.has(topic)) {
                devicesByTopic.set(topic, new Map());
            }
            const topicMap = devicesByTopic.get(topic);
            const deviceKey = ensureString(device?.deviceKey) || buildDeviceKey(device);
            if (!deviceKey || topicMap.has(deviceKey)) return;
            topicMap.set(deviceKey, {
                id: deviceKey,
                deviceKey,
                deviceId: ensureString(device?.deviceId),
                label: ensureString(device?.deviceName || device?.deviceId, deviceKey),
                layerId: resolveLayerId(device),
                farmId: ensureString(device?.farmId),
                unitType: ensureString(device?.unitType),
                unitId: ensureString(device?.unitId),
            });
        });
    });

    const result = {};
    devicesByTopic.forEach((topicMap, topic) => {
        result[topic] = Array.from(topicMap.values()).sort(
            (a, b) => a.label.localeCompare(b.label) || a.deviceKey.localeCompare(b.deviceKey),
        );
    });
    return result;
};

const arraysEqual = (a, b) => a.length === b.length && a.every((value) => b.includes(value));

export function ReportsFiltersProvider({ children }) {
    const location = useLocation();
    const normalizedPath = location?.pathname?.replace(/\/+$/, "") || "/";
    const isReportsRoute = normalizedPath === "/reports";

    const [deviceMeta, setDeviceMeta] = useState({ devices: [] });
    const [topicIds, setTopicIds] = useState(() => DEFAULT_REPORT_TOPICS.slice());
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() - 6);
        return toLocalInputValue(d);
    });
    const [toDate, setToDate] = useState(() => toLocalInputValue(new Date()));
    const [autoRefreshValue, setAutoRefreshValue] = useState("Off");

    const [apiTopicSensors, setApiTopicSensors] = useState({});
    const [selectedTopics, setSelectedTopics] = useState(() =>
        topicIds.length ? [topicIds[0]] : [],
    );
    const [sensorSelections, setSensorSelections] = useState(() =>
        createSensorSelectionState(topicIds),
    );
    const [locationFilters, setLocationFilters] = useState({
        systems: [],
        layers: [],
        devices: [],
    });
    const [selectedDeviceKeys, setSelectedDeviceKeys] = useState([]);
    const [compareItems, setCompareItems] = useState([]);

    useEffect(() => {
        if (!isReportsRoute) return undefined;

        let cancelled = false;
        const controller = new AbortController();

        const loadMeta = async () => {
            try {
                const { catalog, error } = await fetchDeviceCatalog({ signal: controller.signal });
                if (cancelled) return;
                if (catalog?.devices?.length) {
                    setDeviceMeta(catalog);
                } else {
                    setDeviceMeta({ devices: [] });
                    if (error) {
                        console.error("Unable to load device catalog for reports", error);
                    }
                }
            } catch (err) {
                if (cancelled || err?.name === "AbortError") return;
                setDeviceMeta({ devices: [] });
                console.error("Unable to load device catalog for reports", err);
            }
        };

        loadMeta();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [isReportsRoute]);

    useEffect(() => {
        if (!isReportsRoute) return undefined;

        let cancelled = false;
        const controller = new AbortController();

        const loadTopicSensors = async () => {
            try {
                const { topics: topicEntries, error } = await fetchTopicSensors({ signal: controller.signal });
                if (cancelled) return;

                if (Array.isArray(topicEntries) && topicEntries.length) {
                    const nextSensors = {};
                    const apiTopics = [];
                    topicEntries.forEach((entry) => {
                        const topicId = ensureString(entry?.topic);
                        if (!topicId) return;
                        apiTopics.push(topicId);
                        const sensorList = Array.isArray(entry?.sensorTypes) ? entry.sensorTypes : [];
                        const deduped = new Map();
                        sensorList.forEach((sensor) => {
                            const label = ensureString(sensor);
                            if (!label) return;
                            const normalized = normalizeSensorKey(label);
                            if (!normalized || deduped.has(normalized)) return;
                            deduped.set(normalized, {
                                id: label,
                                label,
                                topic: topicId,
                            });
                        });
                        nextSensors[topicId] = Array.from(deduped.values());
                    });

                    setApiTopicSensors(nextSensors);
                    setTopicIds((prev) => {
                        const deduped = dedupeTopics(DEFAULT_REPORT_TOPICS, apiTopics);
                        if (
                            prev.length === deduped.length &&
                            prev.every((topic, index) => topic === deduped[index])
                        ) {
                            return prev;
                        }
                        return deduped;
                    });
                } else {
                    setApiTopicSensors({});
                    setTopicIds(DEFAULT_REPORT_TOPICS.slice());
                }

                if (error) {
                    console.error("Unable to load topic sensors", error);
                }
            } catch (err) {
                if (cancelled || err?.name === "AbortError") return;
                console.error("Unable to load topic sensors", err);
                setApiTopicSensors({});
                setTopicIds(DEFAULT_REPORT_TOPICS.slice());
            }
        };

        loadTopicSensors();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [isReportsRoute]);

    useEffect(() => {
        setSensorSelections((prev) => {
            const next = createSensorSelectionState(topicIds, prev);
            const keys = Object.keys(next);
            const same =
                keys.length === Object.keys(prev).length &&
                keys.every((key) => {
                    const current = prev[key];
                    const proposed = next[key];
                    if (!current || current.size !== proposed.size) return false;
                    for (const value of current) {
                        if (!proposed.has(value)) return false;
                    }
                    return true;
                });
            return same ? prev : next;
        });
    }, [topicIds]);

    useEffect(() => {
        setSelectedTopics((prev) => {
            const valid = prev.filter((topic) => topicIds.includes(topic));
            if (valid.length) return valid;
            return topicIds.length ? [topicIds[0]] : [];
        });
    }, [topicIds]);

    const deviceRows = useMemo(
        () => (Array.isArray(deviceMeta?.devices) ? deviceMeta.devices : []),
        [deviceMeta],
    );

    const deviceIdentityMap = useMemo(() => {
        const map = new Map();
        deviceRows.forEach((row) => {
            const key = row?.deviceKey || buildDeviceKey(row);
            if (key) {
                map.set(key, row);
            }
        });
        return map;
    }, [deviceRows]);

    const systems = useMemo(() => {
        const ids = new Set();
        deviceRows.forEach((row) => {
            if (row?.farmId) ids.add(row.farmId);
        });
        return Array.from(ids).sort();
    }, [deviceRows]);

    const layers = useMemo(() => {
        const ids = new Set();
        deviceRows.forEach((row) => {
            if (locationFilters.systems.length && !locationFilters.systems.includes(row.farmId)) return;
            if (row?.layerId) ids.add(row.layerId);
        });
        return Array.from(ids).sort();
    }, [deviceRows, locationFilters.systems]);

    const deviceIds = useMemo(() => {
        const ids = new Set();
        deviceRows.forEach((row) => {
            if (locationFilters.systems.length && !locationFilters.systems.includes(row.farmId)) return;
            if (locationFilters.layers.length && !locationFilters.layers.includes(row.layerId)) return;
            if (row?.deviceId) ids.add(row.deviceId);
        });
        return Array.from(ids).sort();
    }, [deviceRows, locationFilters.systems, locationFilters.layers]);

    useEffect(() => {
        setLocationFilters((prev) => {
            const nextSystems = prev.systems.filter((id) => systems.includes(id));
            const nextLayers = prev.layers.filter((id) => layers.includes(id));
            const nextDevices = prev.devices.filter((id) => deviceIds.includes(id));
            if (
                arraysEqual(nextSystems, prev.systems) &&
                arraysEqual(nextLayers, prev.layers) &&
                arraysEqual(nextDevices, prev.devices)
            ) {
                return prev;
            }
            return { systems: nextSystems, layers: nextLayers, devices: nextDevices };
        });
    }, [systems, layers, deviceIds]);

    const filteredDeviceRows = useMemo(
        () =>
            deviceRows.filter((row) => {
                const matchSystem =
                    !locationFilters.systems.length || locationFilters.systems.includes(row.farmId);
                const matchLayer =
                    !locationFilters.layers.length || locationFilters.layers.includes(row.layerId);
                const matchDevice =
                    !locationFilters.devices.length || locationFilters.devices.includes(row.deviceId);
                return matchSystem && matchLayer && matchDevice;
            }),
        [deviceRows, locationFilters],
    );

    const availableTopicDevices = useMemo(
        () => buildTopicDeviceMap(topicIds, deviceRows),
        [topicIds, deviceRows],
    );

    const availableTopicSensors = useMemo(
        () => buildTopicSensorMap(topicIds, apiTopicSensors, deviceRows),
        [topicIds, apiTopicSensors, deviceRows],
    );

    const knownDeviceKeys = useMemo(() => {
        const set = new Set();
        Object.values(availableTopicDevices || {}).forEach((devices) => {
            (devices || []).forEach((device) => {
                if (device?.deviceKey) set.add(device.deviceKey);
            });
        });
        return set;
    }, [availableTopicDevices]);

    const selectedTopicIds = useMemo(() => [...selectedTopics], [selectedTopics]);
    const selectedTopicsSet = useMemo(() => new Set(selectedTopicIds), [selectedTopicIds]);

    useEffect(() => {
        setSelectedDeviceKeys((prev) => {
            if (!prev.length) return prev;
            const filtered = prev.filter((key) => knownDeviceKeys.has(key));
            return filtered.length === prev.length ? prev : filtered;
        });
    }, [knownDeviceKeys]);

    useEffect(() => {
        if (!selectedTopicIds.length) return;
        const topic = selectedTopicIds[0];
        const rawCount = deviceRows.length;
        const filteredCount = availableTopicDevices?.[topic]?.length || 0;
        if (rawCount > 0 && filteredCount === 0) {
            console.warn("Reports: devices filtered out", {
                topic,
                rawCount,
                filteredCount,
                sample: deviceRows[0],
            });
        }
    }, [selectedTopicIds, deviceRows, availableTopicDevices]);

    useEffect(() => {
        if (isReportsRoute) return;
        setSelectedDeviceKeys([]);
    }, [isReportsRoute]);

    const selectedDeviceFilters = useMemo(() => {
        if (selectedDeviceKeys.length) return selectedDeviceKeys;
        if (selectedTopicIds.length === 1) {
            const topicDevices = availableTopicDevices?.[selectedTopicIds[0]] || [];
            if (topicDevices.length) {
                return Array.from(new Set(topicDevices.map((device) => device?.deviceKey).filter(Boolean)));
            }
        }
        return filteredDeviceRows.map((row) => row.deviceKey).filter(Boolean);
    }, [selectedDeviceKeys, selectedTopicIds, availableTopicDevices, filteredDeviceRows]);

    const handleDeviceSelectionChange = useCallback((deviceKeys = []) => {
        if (!Array.isArray(deviceKeys) || deviceKeys.length === 0) {
            setSelectedDeviceKeys([]);
            return;
        }
        const unique = Array.from(new Set(deviceKeys.filter(Boolean)));
        setSelectedDeviceKeys(unique);
    }, []);

    const updateTopicSensors = useCallback((topic, updater) => {
        if (!topic) return;
        setSensorSelections((prev) => {
            const next = { ...prev };
            const current = next[topic] instanceof Set ? new Set(next[topic]) : new Set();
            updater(current);
            next[topic] = current;
            return next;
        });
    }, []);

    const extractSensorKey = useCallback((sensor) => {
        if (!sensor) return "";
        if (typeof sensor === "string") return ensureString(sensor);
        return ensureString(sensor.id || sensor.value || sensor.label);
    }, []);

    const toggleSensor = useCallback(
        (topic, key) => {
            if (!topic || !key) return;
            updateTopicSensors(topic, (set) => {
                if (set.has(key)) {
                    set.delete(key);
                } else {
                    set.add(key);
                }
            });
        },
        [updateTopicSensors],
    );

    const setAllSensors = useCallback(
        (topic, keys = []) => {
            if (!topic) return;
            const labels = Array.isArray(keys) ? keys : [];
            updateTopicSensors(topic, (set) => {
                set.clear();
                labels.forEach((k) => {
                    if (k && Array.isArray(k?.sensorValues) && k.sensorValues.length) {
                        k.sensorValues.forEach((sensor) => {
                            const value = extractSensorKey(sensor);
                            if (value) set.add(value);
                        });
                    } else {
                        const value = extractSensorKey(k);
                        if (value) set.add(value);
                    }
                });
            });
        },
        [updateTopicSensors, extractSensorKey],
    );

    const addSensors = useCallback(
        (topic, keys = []) => {
            if (!topic) return;
            const labels = Array.isArray(keys) ? keys : [];
            updateTopicSensors(topic, (set) => {
                labels.forEach((k) => {
                    if (k && Array.isArray(k?.sensorValues) && k.sensorValues.length) {
                        k.sensorValues.forEach((sensor) => {
                            const value = extractSensorKey(sensor);
                            if (value) set.add(value);
                        });
                    } else {
                        const value = extractSensorKey(k);
                        if (value) set.add(value);
                    }
                });
            });
        },
        [updateTopicSensors, extractSensorKey],
    );

    const removeSensors = useCallback(
        (topic, keys = []) => {
            if (!topic) return;
            const labels = Array.isArray(keys) ? keys : [];
            updateTopicSensors(topic, (set) => {
                labels.forEach((k) => {
                    if (k && Array.isArray(k?.sensorValues) && k.sensorValues.length) {
                        k.sensorValues.forEach((sensor) => {
                            const value = extractSensorKey(sensor);
                            if (value) set.delete(value);
                        });
                    } else {
                        const value = extractSensorKey(k);
                        if (value) set.delete(value);
                    }
                });
            });
        },
        [updateTopicSensors, extractSensorKey],
    );

    const clearSensors = useCallback(
        (topic) => {
            if (!topic) return;
            updateTopicSensors(topic, (set) => {
                set.clear();
            });
        },
        [updateTopicSensors],
    );

    const topicOptions = useMemo(
        () =>
            topicIds.map((topic) => ({
                id: topic,
                label: formatTopicLabel(topic),
            })),
        [topicIds],
    );

    const selectedTopicSensors = useMemo(() => {
        const map = {};
        topicIds.forEach((topic) => {
            map[topic] = Array.from(sensorSelections[topic] || []);
        });
        return map;
    }, [topicIds, sensorSelections]);

    const selectedSensorTypes = useMemo(() => {
        const types = new Set();
        selectedTopicIds.forEach((topic) => {
            (selectedTopicSensors[topic] || []).forEach((sensor) => {
                if (sensor) types.add(sensor);
            });
        });
        return Array.from(types);
    }, [selectedTopicIds, selectedTopicSensors]);

    const handleSystemChange = useCallback(
        (e) => {
            const value = e.target.value;
            setLocationFilters((prev) => {
                if (value === "ALL") {
                    return { ...prev, systems: systems.slice() };
                }
                if (value === "") {
                    return { ...prev, systems: [] };
                }
                return { ...prev, systems: toggleValue(prev.systems, value) };
            });
        },
        [systems],
    );

    const handleLayerChange = useCallback(
        (e) => {
            const value = e.target.value;
            setLocationFilters((prev) => {
                if (value === "ALL") {
                    return { ...prev, layers: layers.slice() };
                }
                if (value === "") {
                    return { ...prev, layers: [] };
                }
                return { ...prev, layers: toggleValue(prev.layers, value) };
            });
        },
        [layers],
    );

    const handleDeviceChange = useCallback(
        (e) => {
            const value = e.target.value;
            setLocationFilters((prev) => {
                if (value === "ALL") {
                    return { ...prev, devices: deviceIds.slice() };
                }
                if (value === "") {
                    return { ...prev, devices: [] };
                }
                return { ...prev, devices: toggleValue(prev.devices, value) };
            });
        },
        [deviceIds],
    );

    const onReset = useCallback(() => {
        setLocationFilters({ systems: [], layers: [], devices: [] });
        setSelectedDeviceKeys([]);
        setSelectedTopics(topicIds.length ? [topicIds[0]] : []);
        setSensorSelections(createSensorSelectionState(topicIds));
    }, [topicIds]);

    const onAddCompare = useCallback(() => {
        if (!selectedDeviceFilters.length) return;
        const autoBucket = pickBucket(fromDate, toDate);
        const sensorsSelected = selectedTopicIds.flatMap((topic) =>
            Array.from(sensorSelections[topic] || []),
        );
        setCompareItems((prev) => [
            ...prev,
            {
                id: String(Date.now()),
                title: `${selectedDeviceFilters[0]} (${autoBucket})`,
                from: toISOSeconds(fromDate),
                to: toISOSeconds(toDate),
                sensors: sensorsSelected,
            },
        ]);
    }, [fromDate, toDate, sensorSelections, selectedTopicIds, selectedDeviceFilters]);

    const onRemoveCompare = useCallback((id) => {
        setCompareItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const onClearCompare = useCallback(() => {
        setCompareItems([]);
    }, []);

    const toggleTopicSelection = useCallback((topic) => {
        if (!topic) return;
        setSelectedTopics((prev) => {
            if (prev.includes(topic)) {
                if (prev.length === 1) return prev;
                return prev.filter((id) => id !== topic);
            }
            return [topic];
        });
    }, []);

    const setAllTopics = useCallback(() => {
        setSelectedTopics(topicIds.slice());
    }, [topicIds]);

    const clearTopics = useCallback(() => {
        setSelectedTopics([]);
    }, []);

    const applyHandlerRef = useRef(() => {});

    const registerApplyHandler = useCallback((handler) => {
        if (typeof handler === "function") {
            applyHandlerRef.current = handler;
        } else {
            applyHandlerRef.current = () => {};
        }
    }, []);

    const triggerApply = useCallback(() => {
        applyHandlerRef.current();
    }, []);

    const value = useMemo(
        () => ({
            isReportsRoute,
            deviceMeta,
            deviceIdentityMap,
            deviceIdentityMap,
            fromDate,
            setFromDate,
            toDate,
            setToDate,
            autoRefreshValue,
            setAutoRefreshValue,
            systems,
            layers,
            deviceIds,
            handleSystemChange,
            handleLayerChange,
            handleDeviceChange,
            onReset,
            onAddCompare,
            onRemoveCompare,
            onClearCompare,
            compareItems,
            topics: topicOptions,
            selSensors: sensorSelections,
            selectedTopics: selectedTopicsSet,
            selectedTopicIds,
            selectedTopicSensors,
            selectedSensorTypes,
            toggleTopicSelection,
            setAllTopics,
            clearTopics,
            availableTopicSensors,
            availableTopicDevices,
            toggleSensor,
            setAllSensors,
            addSensors,
            removeSensors,
            clearSensors,
            selectedDeviceFilters,
            selectedDeviceKeys,
            handleDeviceSelectionChange,
            registerApplyHandler,
            triggerApply,
        }),
        [
            isReportsRoute,
            deviceMeta,
            deviceIdentityMap,
            fromDate,
            toDate,
            autoRefreshValue,
            systems,
            layers,
            deviceIds,
            handleSystemChange,
            handleLayerChange,
            handleDeviceChange,
            onReset,
            onAddCompare,
            onRemoveCompare,
            onClearCompare,
            compareItems,
            topicOptions,
            sensorSelections,
            selectedTopicsSet,
            selectedTopicIds,
            selectedTopicSensors,
            selectedSensorTypes,
            toggleTopicSelection,
            setAllTopics,
            clearTopics,
            availableTopicSensors,
            availableTopicDevices,
            toggleSensor,
            setAllSensors,
            addSensors,
            removeSensors,
            clearSensors,
            selectedDeviceFilters,
            selectedDeviceKeys,
            handleDeviceSelectionChange,
            registerApplyHandler,
            triggerApply,
        ],
    );

    return <ReportsFiltersContext.Provider value={value}>{children}</ReportsFiltersContext.Provider>;
}

/* eslint-disable-next-line react-refresh/only-export-components */
export function useReportsFilters() {
    const context = useContext(ReportsFiltersContext);
    if (!context) {
        throw new Error("useReportsFilters must be used within a ReportsFiltersProvider");
    }
    return context;
}
