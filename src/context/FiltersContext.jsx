import React, { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useFilters = () => useContext(Ctx);
export const ALL = "ALL";

export function FiltersProvider({ children, initialLists }) {
    const [layer, setLayerState] = useState([]);
    const [system, setSystemState] = useState([]);
    const [topic, setTopicState] = useState([]);
    const [device, setDeviceState] = useState([]);
    const [timing, setTimingState] = useState([]);
    const [location, setLocationState] = useState([]);
    const [sensorType, setSensorTypeState] = useState([]);
    const [lists, setListsState] = useState({
        layers: initialLists?.layers ?? [],
        systems: initialLists?.systems ?? [],
        topics: initialLists?.topics ?? [],
        timings: initialLists?.timings ?? [],
        locations: initialLists?.locations ?? [],
        sensorTypes: initialLists?.sensorTypes ?? [],
    });

    const setLists = (next) => setListsState((prev) => ({ ...prev, ...next }));

    const toggle = (setter) => (val) =>
        setter((prev) => {
            if (Array.isArray(val)) return val;
            if (val === ALL) return [];
            return prev.includes(val)
                ? prev.filter((v) => v !== val)
                : [...prev, val];
        });

    const setLayer = toggle(setLayerState);
    const setSystem = toggle(setSystemState);
    const setTopic = toggle(setTopicState);
    const setDevice = toggle(setDeviceState);
    const setTiming = toggle(setTimingState);
    const setLocation = toggle(setLocationState);
    const setSensorType = toggle(setSensorTypeState);

    const value = useMemo(
        () => ({
            ALL,
            layer,
            system,
            topic,
            device,
            timing,
            location,
            sensorType,
            setLayer,
            setSystem,
            setTopic,
            setDevice,
            setTiming,
            setLocation,
            setSensorType,
            lists,
            setLists,
        }),
        [
            layer,
            system,
            topic,
            device,
            timing,
            location,
            sensorType,
            lists,
            setLayer,
            setSystem,
            setTopic,
            setDevice,
            setTiming,
            setLocation,
            setSensorType,
        ]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
