import React, { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useFilters = () => useContext(Ctx);
export const ALL = "ALL";

export function FiltersProvider({ children, initialLists }) {
    const [device, setDevice] = useState(ALL);
    const [layer, setLayer]   = useState(ALL);
    const [system, setSystem] = useState(ALL);
    const [topic, setTopic] = useState(ALL);

    const [timingState, setTimingState] = useState([]);
    const [locationState, setLocationState] = useState([]);
    const [sensorTypeState, setSensorTypeState] = useState([]);

    const [bucket, setBucket] = useState("1m");
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(60000);

    const toggle = (setter) => (val) => {
        setter((prev) => {
            if (Array.isArray(val)) return val;
            return prev.includes(val)
                ? prev.filter((v) => v !== val)
                : [...prev, val];
        });
    };

    const setTiming = toggle(setTimingState);
    const setLocation = toggle(setLocationState);
    const setSensorType = toggle(setSensorTypeState);

    const [lists, setLists] = useState({
        devices: initialLists?.devices ?? [],
        layers:  initialLists?.layers ?? [],
        systems: initialLists?.systems ?? [],
        topics:  initialLists?.topics ?? [],
        timings: initialLists?.timings ?? [],
        locations: initialLists?.locations ?? [],
        sensorTypes: initialLists?.sensorTypes ?? [],
    });

    const value = useMemo(() => ({
        ALL,
        device, layer, system, topic,
        setDevice, setLayer, setSystem, setTopic,
        timing: timingState, setTiming,
        location: locationState, setLocation,
        sensorType: sensorTypeState, setSensorType,
        bucket, setBucket,
        autoRefresh, setAutoRefresh,
        refreshInterval, setRefreshInterval,
        lists, setLists,
    }), [
        device,
        layer,
        system,
        topic,
        timingState,
        locationState,
        sensorTypeState,
        bucket,
        autoRefresh,
        refreshInterval,
        lists,
        setTiming,
        setLocation,
        setSensorType,
    ]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
