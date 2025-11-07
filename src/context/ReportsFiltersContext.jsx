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

const ReportsFiltersContext = createContext(null);
const toCID = (d) => `${d.systemId}-${d.layerId}-${d.deviceId}`;

export function ReportsFiltersProvider({ children }) {
    const location = useLocation();
    const normalizedPath = location?.pathname?.replace(/\/+$/, "") || "/";
    const isReportsRoute = normalizedPath === "/reports";

    const [deviceMeta, setDeviceMeta] = useState({ devices: [] });

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

    const [selSensors, setSelSensors] = useState({
        water: new Set(),
        light: new Set(),
        blue: new Set(),
        red: new Set(),
        airq: new Set(),
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

    const selectedCIDs = useMemo(() => {
        const arr = Array.from(selCIDs);
        if (arr.length) return arr;
        return Array.from(new Set(filteredDeviceRows.map(toCID)));
    }, [selCIDs, filteredDeviceRows]);

    const updateSensorGroup = useCallback((group, updater) => {
        setSelSensors((prev) => {
            const nextGroup = new Set(prev[group] || []);
            updater(nextGroup);
            return { ...prev, [group]: nextGroup };
        });
    }, []);

    const toggleSensor = useCallback(
        (group, key) => {
            if (!group || !key) return;
            updateSensorGroup(group, (set) => {
                if (set.has(key)) {
                    set.delete(key);
                } else {
                    set.add(key);
                }
            });
        },
        [updateSensorGroup],
    );

    const setAllSensors = useCallback(
        (group, keys = []) => {
            updateSensorGroup(group, (set) => {
                set.clear();
                keys.forEach((k) => set.add(k));
            });
        },
        [updateSensorGroup],
    );

    const clearSensors = useCallback(
        (group) => {
            updateSensorGroup(group, (set) => {
                set.clear();
            });
        },
        [updateSensorGroup],
    );

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
        setSelSensors({
            water: new Set(),
            light: new Set(),
            blue: new Set(),
            red: new Set(),
            airq: new Set(),
        });
    }, []);

    const [compareItems, setCompareItems] = useState([]);

    const onAddCompare = useCallback(() => {
        if (!selectedCIDs.length) return;
        const autoBucket = pickBucket(fromDate, toDate);
        const sensorsSelected = [
            ...selSensors.water,
            ...selSensors.light,
            ...selSensors.blue,
            ...selSensors.red,
            ...selSensors.airq,
        ];
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
    }, [fromDate, toDate, selSensors, selectedCIDs]);

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
            toggleSensor,
            setAllSensors,
            clearSensors,
            selectedCIDs,
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
            toggleSensor,
            setAllSensors,
            clearSensors,
            selectedCIDs,
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
