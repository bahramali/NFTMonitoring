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
import { fetchDeviceCatalog } from "../pages/Reports/utils/catalog";
import { pickBucket, toISOSeconds, toLocalInputValue } from "../pages/Reports/utils/datetime";
import { useLiveDevices } from "../pages/common/useLiveDevices";
import { fetchTopicSensors } from "../api/topics.js";

const ReportsFiltersContext = createContext(null);
const toCID = (d) => `${d.systemId}-${d.layerId}-${d.deviceId}`;
const DEFAULT_REPORT_TOPICS = ["growSensors", "germinationTopic", "waterTank"];

const ensureString = (value, fallback = "") => {
    if (value === undefined || value === null) return fallback;
    const str = String(value).trim();
    return str.length ? str : fallback;
};

export function ReportsFiltersProvider({ children }) {
    const location = useLocation();
    const normalizedPath = location?.pathname?.replace(/\/+$/, "") || "/";
    const isReportsRoute = normalizedPath === "/reports";

    const [deviceMeta, setDeviceMeta] = useState({ devices: [] });
    const [reportTopics, setReportTopics] = useState(DEFAULT_REPORT_TOPICS);
    const { deviceData } = useLiveDevices(reportTopics);

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

    const deviceRows = useMemo(() => deviceMeta?.devices || [], [deviceMeta]);

    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() - 6);
        return toLocalInputValue(d);
    });
    const [toDate, setToDate] = useState(() => toLocalInputValue(new Date()));
    const [autoRefreshValue, setAutoRefreshValue] = useState("Off");

    const [selSystems, setSelSystems] = useState(new Set());
    const [selLayers, setSelLayers] = useState(new Set());
    const [selDevices, setSelDevices] = useState(new Set());
    const [selCIDs, setSelCIDs] = useState(new Set());
    const [selCompositeIds, setSelCompositeIds] = useState(new Set());
    const [apiTopicSensors, setApiTopicSensors] = useState({});

    const [selectedTopics, setSelectedTopics] = useState(() => new Set(DEFAULT_REPORT_TOPICS));
    const prevReportTopicsRef = useRef(reportTopics);
    const [selSensors, setSelSensors] = useState(() => {
        const initial = {};
        DEFAULT_REPORT_TOPICS.forEach((topic) => {
            initial[topic] = new Set();
        });
        return initial;
    });

    useEffect(() => {
        setSelSensors((prev) => {
            const topicSet = new Set(reportTopics);
            let changed = false;
            const next = {};

            reportTopics.forEach((topic) => {
                if (prev[topic]) {
                    next[topic] = prev[topic];
                } else {
                    next[topic] = new Set();
                    changed = true;
                }
            });

            Object.keys(prev).forEach((topic) => {
                if (!topicSet.has(topic)) {
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [reportTopics]);

    useEffect(() => {
        const previousTopics = prevReportTopicsRef.current || [];
        const previousTopicSet = new Set(previousTopics);
        const topicSet = new Set(reportTopics);

        setSelectedTopics((prev) => {
            if (!prev) return new Set(reportTopics);

            const hadAllPrevious =
                previousTopics.length > 0 &&
                previousTopics.every((topic) => prev.has(topic)) &&
                prev.size === previousTopicSet.size;

            let changed = false;
            const next = new Set();

            prev.forEach((topic) => {
                if (topicSet.has(topic)) {
                    next.add(topic);
                } else {
                    changed = true;
                }
            });

            if (hadAllPrevious) {
                reportTopics.forEach((topic) => {
                    if (!next.has(topic)) {
                        next.add(topic);
                        changed = true;
                    }
                });
            }

            if (!changed && next.size === prev.size) {
                return prev;
            }

            return next;
        });

        prevReportTopicsRef.current = reportTopics;
    }, [reportTopics]);

    const systems = useMemo(
        () => Array.from(new Set(deviceRows.map((d) => d.systemId))).sort(),
        [deviceRows],
    );

    const layers = useMemo(() => {
        const filtered = deviceRows.filter((d) => (selSystems.size ? selSystems.has(d.systemId) : true));
        return Array.from(new Set(filtered.map((d) => d.layerId))).sort();
    }, [deviceRows, selSystems]);

    const filteredDeviceRows = useMemo(
        () =>
            deviceRows.filter(
                (d) =>
                    (selSystems.size ? selSystems.has(d.systemId) : true) &&
                    (selLayers.size ? selLayers.has(d.layerId) : true),
            ),
        [deviceRows, selSystems, selLayers],
    );

    const deviceIds = useMemo(
        () => Array.from(new Set(filteredDeviceRows.map((d) => d.deviceId))).sort(),
        [filteredDeviceRows],
    );

    useEffect(() => {
        if (!isReportsRoute) return undefined;

        let cancelled = false;
        const controller = new AbortController();

        const loadTopicSensors = async () => {
            try {
                const { topics: topicEntries, error } = await fetchTopicSensors({ signal: controller.signal });
                if (cancelled) return;

                if (Array.isArray(topicEntries) && topicEntries.length) {
                    const next = {};
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
                        next[topicId] = Array.from(deduped.values());
                    });
                    const dedupedTopics = [];
                    const seenTopics = new Set();
                    const addTopic = (topic) => {
                        if (!topic || seenTopics.has(topic)) return;
                        seenTopics.add(topic);
                        dedupedTopics.push(topic);
                    };
                    DEFAULT_REPORT_TOPICS.forEach(addTopic);
                    apiTopics.forEach(addTopic);

                    setReportTopics((prev) => {
                        if (
                            prev.length === dedupedTopics.length &&
                            prev.every((topic, index) => topic === dedupedTopics[index])
                        ) {
                            return prev;
                        }
                        return dedupedTopics;
                    });
                    setApiTopicSensors(next);
                } else {
                    setApiTopicSensors({});
                }

                if (error) {
                    console.error("Unable to load topic sensors", error);
                }
            } catch (err) {
                if (cancelled || err?.name === "AbortError") return;
                console.error("Unable to load topic sensors", err);
                setApiTopicSensors({});
            }
        };

        loadTopicSensors();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [isReportsRoute]);

    const availableTopicSensors = useMemo(() => {
        const sensorsMap = new Map();
        reportTopics.forEach((topic) => {
            sensorsMap.set(topic, new Map());
        });

        Object.entries(apiTopicSensors || {}).forEach(([topicKey, sensors]) => {
            if (!sensorsMap.has(topicKey)) {
                sensorsMap.set(topicKey, new Map());
            }
            const topicSensors = sensorsMap.get(topicKey);
            (sensors || []).forEach((sensor) => {
                if (!sensor?.label) return;
                const id = ensureString(sensor?.id, sensor.label.toLowerCase());
                if (!topicSensors.has(id)) {
                    topicSensors.set(id, {
                        id,
                        label: sensor.label,
                        topic: topicKey,
                    });
                }
            });
        });

        Object.values(deviceData || {}).forEach((systemEntry) => {
            if (!systemEntry || typeof systemEntry !== "object") return;
            Object.entries(systemEntry).forEach(([topicKey, devices]) => {
                if (!sensorsMap.has(topicKey)) {
                    sensorsMap.set(topicKey, new Map());
                }
                const topicSensors = sensorsMap.get(topicKey);
                Object.values(devices || {}).forEach((device) => {
                    (device?.sensors || []).forEach((sensor) => {
                        const rawLabel =
                            ensureString(sensor?.sensorType) ||
                            ensureString(sensor?.valueType) ||
                            ensureString(sensor?.sensorName) ||
                            ensureString(sensor?.name);
                        if (!rawLabel) return;
                        const normalized = rawLabel.toLowerCase();
                        if (!topicSensors.has(normalized)) {
                            topicSensors.set(normalized, {
                                id: normalized,
                                label: rawLabel,
                                topic: topicKey,
                            });
                        }
                    });
                });
            });
        });

        const result = {};
        sensorsMap.forEach((topicSet, topicKey) => {
            const sensors = Array.from(topicSet.values()).sort((a, b) => a.label.localeCompare(b.label));
            result[topicKey] = sensors;
        });
        return result;
    }, [apiTopicSensors, deviceData, reportTopics]);

    useEffect(() => {
        if (!isReportsRoute) return;
        const filtered = deviceRows.filter(
            (d) =>
                (selSystems.size ? selSystems.has(d.systemId) : true) &&
                (selLayers.size ? selLayers.has(d.layerId) : true) &&
                (selDevices.size ? selDevices.has(d.deviceId) : true),
        );
        setSelCIDs(new Set(filtered.map(toCID)));
    }, [isReportsRoute, deviceRows, selSystems, selLayers, selDevices]);

    useEffect(() => {
        const valid = new Set(deviceRows.map(toCID));
        setSelCompositeIds((prev) => {
            if (!prev.size) return prev;
            let changed = false;
            const next = new Set();
            prev.forEach((cid) => {
                if (valid.has(cid)) {
                    next.add(cid);
                } else {
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [deviceRows]);

    useEffect(() => {
        if (isReportsRoute) return;
        setSelCompositeIds(new Set());
    }, [isReportsRoute]);

    const selectedCIDs = useMemo(() => {
        const compositeArr = Array.from(selCompositeIds);
        if (compositeArr.length) return compositeArr;

        const arr = Array.from(selCIDs);
        if (arr.length) return arr;
        return Array.from(new Set(filteredDeviceRows.map(toCID)));
    }, [selCompositeIds, selCIDs, filteredDeviceRows]);

    const handleCompositeSelectionChange = useCallback((compositeIds = []) => {
        if (!Array.isArray(compositeIds) || compositeIds.length === 0) {
            setSelCompositeIds(new Set());
            return;
        }
        setSelCompositeIds(new Set(compositeIds));
    }, []);

    const updateTopicSensors = useCallback((topic, updater) => {
        if (!topic) return;
        setSelSensors((prev) => {
            const existing = prev[topic] || new Set();
            const nextSet = new Set(existing);
            updater(nextSet);
            return { ...prev, [topic]: nextSet };
        });
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
                    const value = typeof k === "string" ? k : k?.label;
                    if (value) set.add(value);
                });
            });
        },
        [updateTopicSensors],
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

    const toggleTopicSelection = useCallback((topic) => {
        if (!topic) return;
        setSelectedTopics((prev) => {
            const next = new Set(prev);
            if (next.has(topic)) {
                next.delete(topic);
            } else {
                next.add(topic);
            }
            return next;
        });
    }, []);

    const setAllTopics = useCallback(() => {
        setSelectedTopics(new Set(reportTopics));
    }, [reportTopics]);

    const clearTopics = useCallback(() => {
        setSelectedTopics(new Set());
    }, []);

    const handleSystemChange = useCallback(
        (e) => {
            const v = e.target.value;
            if (v === "ALL") {
                setSelSystems(new Set(systems));
            } else if (v === "") {
                setSelSystems(new Set());
            } else {
                setSelSystems((prev) => {
                    const next = new Set(prev);
                    if (next.has(v)) next.delete(v);
                    else next.add(v);
                    return next;
                });
            }
        },
        [systems],
    );

    const handleLayerChange = useCallback(
        (e) => {
            const v = e.target.value;
            if (v === "ALL") {
                setSelLayers(new Set(layers));
            } else if (v === "") {
                setSelLayers(new Set());
            } else {
                setSelLayers((prev) => {
                    const next = new Set(prev);
                    if (next.has(v)) next.delete(v);
                    else next.add(v);
                    return next;
                });
            }
        },
        [layers],
    );

    const handleDeviceChange = useCallback(
        (e) => {
            const v = e.target.value;
            if (v === "ALL") {
                setSelDevices(new Set(deviceIds));
            } else if (v === "") {
                setSelDevices(new Set());
            } else {
                setSelDevices((prev) => {
                    const next = new Set(prev);
                    if (next.has(v)) next.delete(v);
                    else next.add(v);
                    return next;
                });
            }
        },
        [deviceIds],
    );

    const onReset = useCallback(() => {
        setSelSystems(new Set());
        setSelLayers(new Set());
        setSelDevices(new Set());
        setSelCIDs(new Set());
        setSelCompositeIds(new Set());
        setSelectedTopics(new Set(reportTopics));
        setSelSensors(() => {
            const reset = {};
            reportTopics.forEach((topic) => {
                reset[topic] = new Set();
            });
            return reset;
        });
    }, [reportTopics]);

    const [compareItems, setCompareItems] = useState([]);

    const onAddCompare = useCallback(() => {
        if (!selectedCIDs.length) return;
        const autoBucket = pickBucket(fromDate, toDate);
        const sensorsSelected = Array.from(selectedTopics).flatMap((topic) => Array.from(selSensors[topic] || []));
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
    }, [fromDate, toDate, selSensors, selectedTopics, selectedCIDs]);

    const onRemoveCompare = useCallback((id) => {
        setCompareItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const onClearCompare = useCallback(() => {
        setCompareItems([]);
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
            selSensors,
            selectedTopics,
            toggleTopicSelection,
            setAllTopics,
            clearTopics,
            availableTopicSensors,
            toggleSensor,
            setAllSensors,
            clearSensors,
            selectedCIDs,
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
            selSensors,
            selectedTopics,
            toggleTopicSelection,
            setAllTopics,
            clearTopics,
            availableTopicSensors,
            toggleSensor,
            setAllSensors,
            clearSensors,
            selectedCIDs,
            handleCompositeSelectionChange,
            registerApplyHandler,
            triggerApply,
        ],
    );

    return (
        <ReportsFiltersContext.Provider value={value}>
            {children}
        </ReportsFiltersContext.Provider>
    );
}

export function useReportsFilters() {
    const context = useContext(ReportsFiltersContext);
    if (!context) {
        throw new Error("useReportsFilters must be used within a ReportsFiltersProvider");
    }
    return context;
}
