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

const ReportsFiltersContext = createContext(null);
const toCID = (d) => `${d.systemId}-${d.layerId}-${d.deviceId}`;
const REPORT_TOPICS = ["growSensors", "germinationTopic", "waterTank"];

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
    const { deviceData } = useLiveDevices(REPORT_TOPICS);

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

    const [selectedTopics, setSelectedTopics] = useState(() => new Set(REPORT_TOPICS));
    const [selSensors, setSelSensors] = useState(() => {
        const initial = {};
        REPORT_TOPICS.forEach((topic) => {
            initial[topic] = new Set();
        });
        return initial;
    });

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

    const availableTopicSensors = useMemo(() => {
        const sensorsMap = new Map();
        REPORT_TOPICS.forEach((topic) => {
            sensorsMap.set(topic, new Map());
        });

        Object.values(deviceData || {}).forEach((systemEntry) => {
            if (!systemEntry || typeof systemEntry !== "object") return;
            Object.entries(systemEntry).forEach(([topicKey, devices]) => {
                if (!REPORT_TOPICS.includes(topicKey)) return;
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
    }, [deviceData]);

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
        setSelectedTopics(new Set(REPORT_TOPICS));
    }, []);

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
        setSelectedTopics(new Set(REPORT_TOPICS));
        setSelSensors(() => {
            const reset = {};
            REPORT_TOPICS.forEach((topic) => {
                reset[topic] = new Set();
            });
            return reset;
        });
    }, []);

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
