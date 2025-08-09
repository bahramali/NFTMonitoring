import React, { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useFilters = () => useContext(Ctx);
export const ALL = "ALL";

export function FiltersProvider({ children, initialLists }) {
    const [device, setDevice] = useState(ALL);
    const [layer, setLayer]   = useState(ALL);
    const [system, setSystem] = useState(ALL);

    const [lists, setLists] = useState({
        devices: initialLists?.devices ?? [],
        layers:  initialLists?.layers ?? [],
        systems: initialLists?.systems ?? [],
    });

    const value = useMemo(() => ({
    ALL, device, layer, system,
    setDevice, setLayer, setSystem,
    lists, setLists,
    }), [device, layer, system, lists]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
