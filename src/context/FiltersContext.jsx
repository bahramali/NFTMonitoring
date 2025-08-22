import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";

const Ctx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useFilters = () => useContext(Ctx);
export const ALL = "ALL";

export function FiltersProvider({ children, initialLists }) {
    const [device, setDevice] = useState(ALL);
    const [layer, setLayer]   = useState(ALL);
    const [system, setSystem] = useState(ALL);
    const [topic, setTopic] = useState(ALL);

    const [lists, setLists] = useState({
        devices: initialLists?.devices ?? [],
        layers:  initialLists?.layers ?? [],
        systems: initialLists?.systems ?? [],
        topics:  initialLists?.topics ?? [],
    });

    const mergeLists = useCallback((incoming = {}) => {
        setLists(prev => ({
            devices: Array.from(new Set([...(prev.devices || []), ...(incoming.devices || [])])),
            layers:  Array.from(new Set([...(prev.layers  || []), ...(incoming.layers  || [])])),
            systems: Array.from(new Set([...(prev.systems || []), ...(incoming.systems || [])])),
            topics:  Array.from(new Set([...(prev.topics  || []), ...(incoming.topics  || [])])),
        }));
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const key = "deviceCatalog";

        const extractLists = (data) => {
            const devices = (data?.devices || []).map(d => `${d.systemId}-${d.layerId}-${d.deviceId}`);
            const layers = Array.from(new Set((data?.devices || []).map(d => d.layerId))).sort();
            const systems = Array.from(new Set([
                ...((data?.systems || []).map(s => s.id)),
                ...((data?.devices || []).map(d => d.systemId))
            ])).sort();
            return { devices, layers, systems, topics: [] };
        };

        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const data = JSON.parse(cached);
                mergeLists(extractLists(data));
            }
        } catch { /* ignore */ }

        fetch("https://api.hydroleaf.se/api/devices/all")
            .then(res => res.json())
            .then(data => {
                try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
                mergeLists(extractLists(data));
            })
            .catch(() => { /* ignore fetch errors */ });
    }, [mergeLists]);

    const value = useMemo(() => ({
    ALL, device, layer, system, topic,
    setDevice, setLayer, setSystem, setTopic,
    lists, setLists: mergeLists,
    }), [device, layer, system, topic, lists, mergeLists]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
