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

    const [lists, setLists] = useState({
        layers: initialLists?.layers ?? [],
        systems: initialLists?.systems ?? [],
        topics: initialLists?.topics ?? [],
    });

    const toggle = (setter) => (val) =>
        setter((prev) => {
            if (val === ALL) return [];
            return prev.includes(val)
                ? prev.filter((v) => v !== val)
                : [...prev, val];
        });

    const setLayer = toggle(setLayerState);
    const setSystem = toggle(setSystemState);
    const setTopic = toggle(setTopicState);
    const setDevice = toggle(setDeviceState);

    const value = useMemo(
        () => ({
            ALL,
            layer,
            system,
            topic,
            device,
            setLayer,
            setSystem,
            setTopic,
            setDevice,
            lists,
            setLists,
        }),
        [layer, system, topic, device, lists]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
