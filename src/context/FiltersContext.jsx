import React, { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useFilters = () => useContext(Ctx);
export const ALL = "ALL";

export function FiltersProvider({ children, initialLists }) {
    const [layer, setLayer] = useState(ALL);
    const [system, setSystem] = useState(ALL);
    const [topic, setTopic] = useState(ALL);

    const [lists, setLists] = useState({
        layers: initialLists?.layers ?? [],
        systems: initialLists?.systems ?? [],
        topics: initialLists?.topics ?? [],
    });

    const value = useMemo(() => ({
        ALL,
        layer,
        system,
        topic,
        setLayer,
        setSystem,
        setTopic,
        lists,
        setLists,
    }), [layer, system, topic, lists]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
