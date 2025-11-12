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
import { useLiveDevices } from "../../common/useLiveDevices";
import { fetchTopicSensors } from "../../../api/topics.js";
import { ensureString } from "../utils/strings";

const ReportsFiltersContext = createContext(null);

const DEFAULT_REPORT_TOPICS = ["growSensors", "germinationTopic", "waterTank"];

const formatTopicLabel = (id) =>
    String(id || "")
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/^\s+|\s+$/g, "")
        .replace(/^./, (ch) => ch.toUpperCase());

const toCID = (d) => `${d.systemId}-${d.layerId}-${d.deviceId}`;

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

const buildTopicSensorMap = (topics, apiTopicSensors, deviceData) => {
    const sensorsByTopic = new Map();
    topics.forEach((topic) => {
        sensorsByTopic.set(topic, new Map());
    });

    Object.entries(apiTopicSensors || {}).forEach(([topic, sensors]) => {
        if (!sensorsByTopic.has(topic)) {
            sensorsByTopic.set(topic, new Map());
        }
        const topicMap = sensorsByTopic.get(topic);
        (sensors || []).forEach((sensor) => {
            const rawLabel = ensureString(sensor?.label, sensor?.id, sensor);
            if (!rawLabel) return;
            const id = ensureString(sensor?.id, rawLabel.toLowerCase());
            if (!topicMap.has(id)) {
                topicMap.set(id, {
                    id,
                    label: rawLabel,
                    topic,
                });
            }
        });
    });

    Object.values(deviceData || {}).forEach((systemEntry) => {
        Object.entries(systemEntry || {}).forEach(([topic, devices]) => {
            if (!sensorsByTopic.has(topic)) {
                sensorsByTopic.set(topic, new Map());
            }
            const topicMap = sensorsByTopic.get(topic);
            Object.values(devices || {}).forEach((device) => {
                (device?.sensors || []).forEach((sensor) => {
                    const rawLabel =
                        ensureString(sensor?.sensorType) ||
                        ensureString(sensor?.valueType) ||
                        ensureString(sensor?.sensorName) ||
                        ensureString(sensor?.name);
                    if (!rawLabel) return;
                    const id = rawLabel.toLowerCase();
                    if (!topicMap.has(id)) {
                        topicMap.set(id, {
                            id,
                            label: rawLabel,
                            topic,
                        });
                    }
                });
            });
        });
    });

    const result = {};
    sensorsByTopic.forEach((topicMap, topic) => {
        result[topic] = Array.from(topicMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    });
    return result;
};

const buildTopicDeviceMap = (topics, deviceData) => {
    const devicesByTopic = new Map();
    topics.forEach((topic) => {
        devicesByTopic.set(topic, new Map());
    });

    Object.values(deviceData || {}).forEach((systemEntry) => {
        Object.entries(systemEntry || {}).forEach(([topic, devices]) => {
            if (!devicesByTopic.has(topic)) {
                devicesByTopic.set(topic, new Map());
            }
            const topicMap = devicesByTopic.get(topic);
            Object.values(devices || {}).forEach((device) => {
                const compositeId = ensureString(device?.compositeId);
                if (!compositeId || topicMap.has(compositeId)) return;
                topicMap.set(compositeId, {
                    id: compositeId,
                    compositeId,
                    deviceId: ensureString(device?.deviceId, compositeId),
                    label: ensureString(device?.deviceId || device?.compositeId, compositeId),
                    layerId: ensureString(device?.layer),
                });
            });
        });
    });

    const result = {};
    devicesByTopic.forEach((topicMap, topic) => {
        result[topic] = Array.from(topicMap.values()).sort(
            (a, b) => a.label.localeCompare(b.label) || a.compositeId.localeCompare(b.compositeId),
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
    const { deviceData } = useLiveDevices(topicIds);

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
    const [selectedCompositeIds, setSelectedCompositeIds] = useState([]);
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
                            const id = label.toLowerCase();
                            if (!deduped.has(id)) {
                                deduped.set(id, {
                                    id,
                                    label,
                                    topic: topicId,
                                });
                            }
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

    const systems = useMemo(() => {
        const ids = new Set();
        deviceRows.forEach((row) => {
            if (row?.systemId) ids.add(row.systemId);
        });
        return Array.from(ids).sort();
    }, [deviceRows]);

    const layers = useMemo(() => {
        const ids = new Set();
        deviceRows.forEach((row) => {
            if (locationFilters.systems.length && !locationFilters.systems.includes(row.systemId)) return;
            if (row?.layerId) ids.add(row.layerId);
        });
        return Array.from(ids).sort();
    }, [deviceRows, locationFilters.systems]);

    const deviceIds = useMemo(() => {
        const ids = new Set();
        deviceRows.forEach((row) => {
            if (locationFilters.systems.length && !locationFilters.systems.includes(row.systemId)) return;
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
                    !locationFilters.systems.length || locationFilters.systems.includes(row.systemId);
                const matchLayer =
                    !locationFilters.layers.length || locationFilters.layers.includes(row.layerId);
                const matchDevice =
                    !locationFilters.devices.length || locationFilters.devices.includes(row.deviceId);
                return matchSystem && matchLayer && matchDevice;
            }),
        [deviceRows, locationFilters],
    );

    const availableTopicSensors = useMemo(
        () => buildTopicSensorMap(topicIds, apiTopicSensors, deviceData),
        [topicIds, apiTopicSensors, deviceData],
    );

    const availableTopicDevices = useMemo(
        () => buildTopicDeviceMap(topicIds, deviceData),
        [topicIds, deviceData],
    );

    const knownCompositeIds = useMemo(() => {
        const set = new Set();
        Object.values(availableTopicDevices || {}).forEach((devices) => {
            (devices || []).forEach((device) => {
                if (device?.compositeId) set.add(device.compositeId);
            });
        });
        return set;
    }, [availableTopicDevices]);

    useEffect(() => {
        setSelectedCompositeIds((prev) => {
            if (!prev.length) return prev;
            const filtered = prev.filter((cid) => knownCompositeIds.has(cid));
            return filtered.length === prev.length ? prev : filtered;
        });
    }, [knownCompositeIds]);

    useEffect(() => {
        if (isReportsRoute) return;
        setSelectedCompositeIds([]);
    }, [isReportsRoute]);

    const selectedCIDs = useMemo(() => {
        if (selectedCompositeIds.length) return selectedCompositeIds;
        const uniques = new Set();
        filteredDeviceRows.forEach((row) => {
            uniques.add(toCID(row));
        });
        return Array.from(uniques);
    }, [selectedCompositeIds, filteredDeviceRows]);

    const handleCompositeSelectionChange = useCallback((compositeIds = []) => {
        if (!Array.isArray(compositeIds) || compositeIds.length === 0) {
            setSelectedCompositeIds([]);
            return;
        }
        const unique = Array.from(new Set(compositeIds.filter(Boolean)));
        setSelectedCompositeIds(unique);
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
                    const value = extractSensorKey(k);
                    if (value) set.add(value);
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

    const selectedTopicIds = useMemo(() => [...selectedTopics], [selectedTopics]);
    const selectedTopicsSet = useMemo(() => new Set(selectedTopicIds), [selectedTopicIds]);

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
        setSelectedCompositeIds([]);
        setSelectedTopics(topicIds.length ? [topicIds[0]] : []);
        setSensorSelections(createSensorSelectionState(topicIds));
    }, [topicIds]);

    const onAddCompare = useCallback(() => {
        if (!selectedCIDs.length) return;
        const autoBucket = pickBucket(fromDate, toDate);
        const sensorsSelected = selectedTopicIds.flatMap((topic) =>
            Array.from(sensorSelections[topic] || []),
        );
        setCompareItems((prev) => [
            ...prev,
            {
                id: String(Date.now()),
                title: `${selectedCIDs[0]} (${autoBucket})`,
                from: toISOSeconds(fromDate),
                to: toISOSeconds(toDate),
                sensors: sensorsSelected,
            },
        ]);
    }, [fromDate, toDate, sensorSelections, selectedTopicIds, selectedCIDs]);

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
            clearSensors,
            selectedCIDs,
            selectedCompositeIds,
            handleCompositeSelectionChange,
            registerApplyHandler,
            triggerApply,
        }),
        [
            isReportsRoute,
            deviceMeta,
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
            clearSensors,
            selectedCIDs,
            selectedCompositeIds,
            handleCompositeSelectionChange,
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
