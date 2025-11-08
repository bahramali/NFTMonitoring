import React, {useEffect, useMemo, useRef, useState} from 'react';
import styles from './ReportFiltersCompare.module.css';
import {normalizeDeviceCatalog} from '../utils/catalog';

const DEFAULT_SENSOR_GROUPS = {
    water: ['dissolvedTemp', 'dissolvedEC', 'dissolvedTDS', 'dissolvedOxygen'],
    light: ['VIS1', 'VIS2', 'NIR855', 'light'],
    blue:  ['405nm', '425nm', '450nm', '475nm', '515nm'],
    red:   ['550nm', '555nm', '600nm', '640nm', '690nm', '745nm'],
    airq:  ['humidity', 'temperature', 'CO2'],
};

function AllNone({name, onAll, onNone}) {
    return (
        <div className={styles.allnone}>
            <label><input type="radio" name={name} onChange={onAll}/> All</label>
            <label><input type="radio" name={name} onChange={onNone}/> None</label>
        </div>
    );
}

function Checklist({options = [], values = [], onToggle}) {
    return (
        <div className={styles.checklist}>
            {options.map((opt) => {
                const label = typeof opt === 'string' ? opt : opt.label;
                const disabled = typeof opt === 'string' ? false : !!opt.disabled;
                const checked = values.includes(label);
                return (
                    <label key={label} className={`${styles.item} ${disabled ? styles.disabled : ''}`}>
                        <input
                            type="checkbox"
                            disabled={disabled}
                            checked={onToggle ? checked : undefined}
                            defaultChecked={!onToggle ? checked : undefined}
                            onChange={() => onToggle && onToggle(label)}
                        />
                        {label}
                    </label>
                );
            })}
        </div>
    );
}

function Group({title, name, options = [], values = [], onAll, onNone, onToggle}) {
    const handleAll = () => onAll && onAll(options);
    return (
        <div className={styles.group}>
            <div className={styles.groupTitle}>{title}</div>
            <AllNone name={name} onAll={handleAll} onNone={onNone}/>
            <Checklist options={options} values={values} onToggle={onToggle}/>
        </div>
    );
}

const normKey = (s) =>
    (typeof s === 'string'
            ? s
            : (s?.sensorName || s?.sensorType || s?.valueType || '')
    ).toString().toLowerCase();

const ensureString = (value, fallback = '') => {
    if (value === undefined || value === null) return fallback;
    const str = String(value).trim();
    return str.length ? str : fallback;
};

const toFallbackComposite = (systemId, layerId, deviceId) =>
    [systemId, layerId, deviceId].filter(Boolean).join('-');

const parseCompositeId = (cid) => {
    const value = ensureString(cid);
    if (!value) return { systemId: '', layerId: '', deviceId: '' };
    const parts = value.split('-');
    if (parts.length < 3) {
        return {
            systemId: parts[0] || value,
            layerId: parts[1] || '',
            deviceId: parts[2] || '',
        };
    }
    return {
        systemId: parts[0],
        layerId: parts[1],
        deviceId: parts.slice(2).join('-'),
    };
};

export default function ReportFiltersCompare(props) {
    const {
        className,
        variant = "default",
        fromDate, toDate, onFromDateChange, onToDateChange, onApply,
        autoRefreshValue = 'Off',
        onAutoRefreshValueChange = () => {},

        systems: systemsProp = [],
        layers:  layersProp  = [],
        devices: devicesProp = [],

        onSystemChange, onLayerChange, onDeviceChange,

        water: waterProp, light: lightProp, blue: blueProp, red: redProp, airq: airqProp,
        onToggleWater, onToggleLight, onToggleBlue, onToggleRed, onToggleAirq,
        onAllWater, onNoneWater, onAllLight, onNoneLight, onAllBlue, onNoneBlue, onAllRed, onNoneRed, onAllAirq, onNoneAirq,

        rangeLabel,
        compareItems = [], onClearCompare, onRemoveCompare,
        catalog: catalogProp,
    } = props;

    const catalog = useMemo(() => normalizeDeviceCatalog(catalogProp), [catalogProp]);

    const locationData = useMemo(() => {
        const systemMap = new Map();
        const compositeMeta = new Map();

        const addDevice = ({
            systemId,
            systemLabel,
            layerId,
            layerLabel,
            deviceId,
            deviceLabel,
            compositeId,
        }) => {
            const cid = ensureString(compositeId);
            const sysId = ensureString(systemId);
            const layId = ensureString(layerId);
            const devId = ensureString(deviceId);
            if (!cid || !sysId || !layId || !devId) return;

            if (!compositeMeta.has(cid)) {
                compositeMeta.set(cid, {
                    systemId: sysId,
                    layerId: layId,
                    deviceId: devId,
                    labels: {
                        system: ensureString(systemLabel, sysId),
                        layer: ensureString(layerLabel, layId),
                        device: ensureString(deviceLabel, devId),
                    },
                });
            }

            let systemEntry = systemMap.get(sysId);
            if (!systemEntry) {
                systemEntry = { id: sysId, label: ensureString(systemLabel, sysId), layers: new Map() };
                systemMap.set(sysId, systemEntry);
            }

            let layerEntry = systemEntry.layers.get(layId);
            if (!layerEntry) {
                layerEntry = { id: layId, label: ensureString(layerLabel, layId), devices: [] };
                systemEntry.layers.set(layId, layerEntry);
            }

            if (!layerEntry.devices.some(dev => dev.compositeId === cid)) {
                layerEntry.devices.push({
                    id: devId,
                    label: ensureString(deviceLabel, devId),
                    compositeId: cid,
                });
            }
        };

        const catalogDevices = Array.isArray(catalog?.devices) ? catalog.devices : [];
        catalogDevices.forEach(device => {
            const systemId = ensureString(device.systemId ?? device.system?.id);
            const layerId = ensureString(device.layerId ?? device.layer?.id);
            const deviceId = ensureString(device.deviceId ?? device.id ?? device.device?.id);
            const compositeId = ensureString(device.compositeId ?? toFallbackComposite(systemId, layerId, deviceId));
            const systemLabel = ensureString(device.systemName ?? device.system?.name, systemId);
            const layerLabel = ensureString(device.layerName ?? device.layer?.name, layerId);
            const deviceLabel = ensureString(device.deviceName ?? device.name ?? device.label, deviceId);
            addDevice({
                systemId,
                systemLabel,
                layerId,
                layerLabel,
                deviceId,
                deviceLabel,
                compositeId,
            });
        });

        if (!systemMap.size) {
            const catalogSystems = Array.isArray(catalog?.systems) ? catalog.systems : [];
            catalogSystems.forEach(system => {
                const systemId = ensureString(system.id);
                if (!systemId) return;
                const systemLabel = ensureString(system.name, systemId);

                if (Array.isArray(system.layers)) {
                    system.layers.forEach(layer => {
                        const layerId = ensureString(layer.id);
                        const layerLabel = ensureString(layer.name, layerId);
                        const devices = Array.isArray(layer.devices) ? layer.devices : [];
                        devices.forEach(dev => {
                            const parsed = parseCompositeId(dev.compositeId ?? dev.id);
                            const deviceId = ensureString(dev.deviceId ?? dev.id ?? parsed.deviceId);
                            const compositeId = ensureString(dev.compositeId ?? dev.id ?? toFallbackComposite(systemId, layerId || parsed.layerId, deviceId));
                            const resolvedLayerId = ensureString(layerId || parsed.layerId);
                            addDevice({
                                systemId,
                                systemLabel,
                                layerId: resolvedLayerId,
                                layerLabel: ensureString(layerLabel, resolvedLayerId),
                                deviceId,
                                deviceLabel: ensureString(dev.name ?? dev.label, deviceId),
                                compositeId,
                            });
                        });
                    });
                }

                const compositeCandidates = [
                    ...(Array.isArray(system.deviceCompositeIds) ? system.deviceCompositeIds : []),
                    ...(Array.isArray(system.compositeIds) ? system.compositeIds : []),
                ];
                compositeCandidates.forEach(cid => {
                    const parsed = parseCompositeId(cid);
                    const layerId = ensureString(parsed.layerId || '');
                    const deviceId = ensureString(parsed.deviceId || cid);
                    addDevice({
                        systemId,
                        systemLabel,
                        layerId: layerId || 'Layer',
                        layerLabel: ensureString(parsed.layerId, layerId || 'Layer'),
                        deviceId,
                        deviceLabel: deviceId,
                        compositeId: ensureString(cid),
                    });
                });
            });
        }

        if (!systemMap.size && devicesProp.length) {
            devicesProp.forEach(raw => {
                const cid = ensureString(raw);
                if (!cid || !cid.includes('-')) return;
                const parsed = parseCompositeId(cid);
                const systemId = ensureString(parsed.systemId || 'System');
                const layerId = ensureString(parsed.layerId || 'Layer');
                const deviceId = ensureString(parsed.deviceId || cid);
                addDevice({
                    systemId,
                    systemLabel: systemId,
                    layerId,
                    layerLabel: layerId,
                    deviceId,
                    deviceLabel: deviceId,
                    compositeId: cid,
                });
            });
        }

        const systems = Array.from(systemMap.values()).map(system => ({
            id: system.id,
            label: system.label,
            layers: Array.from(system.layers.values()).map(layer => ({
                id: layer.id,
                label: layer.label,
                devices: layer.devices.sort((a, b) =>
                    a.label.localeCompare(b.label) || a.compositeId.localeCompare(b.compositeId)
                ),
            })).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id)),
        })).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));

        const compositeIds = Array.from(compositeMeta.keys()).sort();

        return { systems, compositeIds, compositeMeta };
    }, [catalog, devicesProp]);

    const { systems: locationSystems, compositeIds, compositeMeta } = locationData;

    useEffect(() => {
        setCollapsedSystems(prev => {
            if (!prev.size) return prev;
            const validSystemIds = new Set(locationSystems.map(system => system.id));
            let changed = false;
            const next = new Set();
            prev.forEach(id => {
                if (validSystemIds.has(id)) next.add(id);
                else changed = true;
            });
            return changed ? next : prev;
        });

        setCollapsedLayers(prev => {
            if (!prev.size) return prev;
            const validLayerKeys = new Set();
            locationSystems.forEach(system => {
                system.layers.forEach(layer => {
                    validLayerKeys.add(`${system.id}::${layer.id}`);
                });
            });
            let changed = false;
            const next = new Set();
            prev.forEach(key => {
                if (validLayerKeys.has(key)) next.add(key);
                else changed = true;
            });
            return changed ? next : prev;
        });
    }, [locationSystems]);

    const [legacySelectedSystems, setLegacySelectedSystems] = useState([]);
    const [legacySelectedLayers, setLegacySelectedLayers] = useState([]);
    const [legacySelectedDevices, setLegacySelectedDevices] = useState([]);
    const [isTreeCollapsed, setIsTreeCollapsed] = useState(true);

    const legacySystems = useMemo(() => {
        if (systemsProp.length) return systemsProp;
        const fromCatalog = (catalog?.systems || []).map(s => ensureString(s.id)).filter(Boolean);
        return Array.from(new Set(fromCatalog));
    }, [systemsProp, catalog]);

    const legacyLayers = useMemo(() => {
        if (layersProp.length) return layersProp;
        const fromCatalog = (catalog?.devices || []).map(d => ensureString(d.layerId ?? d.layer?.id)).filter(Boolean);
        return Array.from(new Set(fromCatalog));
    }, [layersProp, catalog]);

    const legacyDevices = useMemo(() => {
        if (devicesProp.length) return devicesProp;
        const fromCatalog = (catalog?.devices || []).map(d => ensureString(d.deviceId ?? d.id ?? d.device?.id)).filter(Boolean);
        return Array.from(new Set(fromCatalog));
    }, [devicesProp, catalog]);

    const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

    const handleLegacySystemToggle = (id) => {
        setLegacySelectedSystems(prev => toggleIn(prev, id));
    };

    const handleLegacyLayerToggle = (id) => {
        setLegacySelectedLayers(prev => toggleIn(prev, id));
    };

    const handleLegacyDeviceToggle = (id) => {
        setLegacySelectedDevices(prev => toggleIn(prev, id));
    };

    const handleLegacyAllSystems = () => {
        setLegacySelectedSystems([...legacySystems]);
    };

    const handleLegacyNoneSystems = () => {
        setLegacySelectedSystems([]);
    };

    const handleLegacyAllLayers = () => {
        setLegacySelectedLayers([...legacyLayers]);
    };

    const handleLegacyNoneLayers = () => {
        setLegacySelectedLayers([]);
    };

    const handleLegacyAllDevices = () => {
        setLegacySelectedDevices([...legacyDevices]);
    };

    const handleLegacyNoneDevices = () => {
        setLegacySelectedDevices([]);
    };

    const [selectedCompositeIds, setSelectedCompositeIds] = useState(() => new Set());
    const [collapsedSystems, setCollapsedSystems] = useState(() => new Set());
    const [collapsedLayers, setCollapsedLayers] = useState(() => new Set());

    const isLegacyMode = locationSystems.length === 0;

    const selectedSummary = useMemo(() => {
        const sysSet = new Set();
        const laySet = new Set();
        const devSet = new Set();
        for (const cid of selectedCompositeIds) {
            const meta = compositeMeta.get(cid);
            if (!meta) continue;
            if (meta.systemId) sysSet.add(meta.systemId);
            if (meta.layerId) laySet.add(meta.layerId);
            if (meta.deviceId) devSet.add(meta.deviceId);
        }
        return {
            systems: Array.from(sysSet),
            layers: Array.from(laySet),
            devices: Array.from(devSet),
        };
    }, [selectedCompositeIds, compositeMeta]);

    const selectedSystems = selectedSummary.systems;
    const selectedLayers  = selectedSummary.layers;
    const selectedDevices = selectedSummary.devices;

    const activeSelectedSystems = isLegacyMode ? legacySelectedSystems : selectedSystems;
    const activeSelectedLayers  = isLegacyMode ? legacySelectedLayers  : selectedLayers;
    const activeSelectedDevices = isLegacyMode ? legacySelectedDevices : selectedDevices;

    const syncParentSelection = (prev = [], next = [], handler) => {
        if (typeof handler !== 'function') return;
        const prevSet = new Set(prev);
        const nextSet = new Set(next);
        next.forEach(id => {
            if (!prevSet.has(id)) handler({ target: { value: id } });
        });
        prev.forEach(id => {
            if (!nextSet.has(id)) handler({ target: { value: id } });
        });
    };

    const prevSystemsRef = useRef(activeSelectedSystems);
    useEffect(() => {
        syncParentSelection(prevSystemsRef.current, activeSelectedSystems, onSystemChange);
        prevSystemsRef.current = activeSelectedSystems;
    }, [activeSelectedSystems, onSystemChange]);

    const prevLayersRef = useRef(activeSelectedLayers);
    useEffect(() => {
        syncParentSelection(prevLayersRef.current, activeSelectedLayers, onLayerChange);
        prevLayersRef.current = activeSelectedLayers;
    }, [activeSelectedLayers, onLayerChange]);

    const prevDevicesRef = useRef(activeSelectedDevices);
    useEffect(() => {
        syncParentSelection(prevDevicesRef.current, activeSelectedDevices, onDeviceChange);
        prevDevicesRef.current = activeSelectedDevices;
    }, [activeSelectedDevices, onDeviceChange]);

    const mutateCompositeSelection = (mutator) => {
        setSelectedCompositeIds(prev => {
            const next = new Set(prev);
            mutator(next, prev);
            return next;
        });
    };

    const toggleSystemCollapse = (systemId) => {
        if (!systemId) return;
        setCollapsedSystems(prev => {
            const next = new Set(prev);
            if (next.has(systemId)) next.delete(systemId);
            else next.add(systemId);
            return next;
        });
    };

    const toggleLayerCollapse = (layerKey) => {
        if (!layerKey) return;
        setCollapsedLayers(prev => {
            const next = new Set(prev);
            if (next.has(layerKey)) next.delete(layerKey);
            else next.add(layerKey);
            return next;
        });
    };

    useEffect(() => {
        setSelectedCompositeIds(prev => {
            const next = new Set();
            let changed = false;
            for (const cid of prev) {
                if (compositeMeta.has(cid)) next.add(cid);
                else changed = true;
            }
            if (!changed) return prev;
            return next;
        });
    }, [compositeMeta]);

    const handleDeviceToggle = (device, checked) => {
        if (!device) return;
        mutateCompositeSelection((next) => {
            if (checked) next.add(device.compositeId);
            else next.delete(device.compositeId);
        });
    };

    const handleSelectAllLocations = () => {
        setSelectedCompositeIds(new Set(compositeIds));
    };

    const handleClearLocations = () => {
        setSelectedCompositeIds(new Set());
    };

    // filtered catalog devices according to location selection
    const filteredCatalogDevices = useMemo(() => {
        const all = catalog?.devices || [];
        return all.filter(d => {
            const systemId = ensureString(d.systemId ?? d.system?.id);
            const layerId = ensureString(d.layerId ?? d.layer?.id);
            const deviceId = ensureString(d.deviceId ?? d.id ?? d.device?.id);
            const sysOk = !activeSelectedSystems.length || activeSelectedSystems.includes(systemId);
            const layOk = !activeSelectedLayers.length  || activeSelectedLayers.includes(layerId);
            const devOk = !activeSelectedDevices.length || activeSelectedDevices.includes(deviceId);
            return sysOk && layOk && devOk;
        });
    }, [catalog, activeSelectedSystems, activeSelectedLayers, activeSelectedDevices]);

    // composite checkbox state derived from location selection
    const isCompositeChecked = (cid) => selectedCompositeIds.has(cid);


    // sensors: before any location selection, everything disabled (tests expect this)
    const hasAnyLocationSelection =
        activeSelectedSystems.length > 0 || activeSelectedLayers.length > 0 || activeSelectedDevices.length > 0;
    const baseDevicesForUnion = hasAnyLocationSelection ? filteredCatalogDevices : [];

    const sensorGroups = useMemo(() => {
        const base = baseDevicesForUnion;
        const nothingSelected = base.length === 0;
        const union = new Set(base.flatMap(d => (d.sensors || []).map(normKey)));
        const hasSensorInfo = base.some(d => Array.isArray(d.sensors) && d.sensors.length > 0);

        const groups = {};
        Object.entries(DEFAULT_SENSOR_GROUPS).forEach(([grp, labels]) => {
            groups[grp] = labels.map(label => {
                let disabled;
                if (nothingSelected) disabled = true;
                else if (hasSensorInfo) disabled = !union.has(label.toLowerCase());
                else disabled = false;
                return { label, disabled };
            });
        });
        return groups;
    }, [baseDevicesForUnion]);

    const water = {options: sensorGroups.water, values: waterProp?.values || []};
    const light = {options: sensorGroups.light, values: lightProp?.values || []};
    const blue  = {options: sensorGroups.blue,  values: blueProp?.values  || []};
    const red   = {options: sensorGroups.red,   values: redProp?.values   || []};
    const airq  = {options: sensorGroups.airq,  values: airqProp?.values  || []};

    const selectedCompositeCount = selectedCompositeIds.size;
    const totalCompositeCount = compositeIds.length;

    const selectedDeviceNames = useMemo(() => {
        if (!selectedCompositeIds.size) return [];
        const names = new Set();
        selectedCompositeIds.forEach((cid) => {
            const meta = compositeMeta.get(cid);
            const label = meta?.labels?.device || cid;
            if (label) names.add(label);
        });
        return Array.from(names);
    }, [selectedCompositeIds, compositeMeta]);

    useEffect(() => {
        if (typeof onApply === 'function' && selectedCompositeIds.size > 0) {
            onApply();
        }
    }, [selectedCompositeIds, onApply]);

    const containerClassName = [
        styles.rf,
        variant === "sidebar" ? styles.rfSidebar : "",
        className || "",
    ].filter(Boolean).join(" ");

    return (
        <div className={containerClassName}>
            <div className={styles.title}>Filters</div>
            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <div className={styles.block}>
                        <h4>Timing</h4>
                        <div className={styles.sidebarFieldset}>
                            <div className={styles.field}>
                                <span className={styles.label}>From</span>
                                <input type="datetime-local" value={fromDate} onChange={onFromDateChange}/>
                            </div>
                            <div className={styles.field}>
                                <span className={styles.label}>To</span>
                                <input type="datetime-local" value={toDate} onChange={onToDateChange}/>
                            </div>
                            <div className={styles.field}>
                                <span className={styles.label}>Auto refresh</span>
                                <select value={autoRefreshValue} onChange={onAutoRefreshValueChange}>
                                    {['Off','30s','1m','5m'].map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className={styles.block}>
                        <h4>Location</h4>
                        <div className={styles.locationSection}>
                            {isLegacyMode ? (
                                <>
                                    <div className={styles.group}>
                                        <div className={styles.groupTitle}>Systems</div>
                                        <AllNone name="sys-allnone" onAll={handleLegacyAllSystems} onNone={handleLegacyNoneSystems}/>
                                        <div className={styles.checklist}>
                                            {legacySystems.map(s => (
                                                <label key={s} className={styles.item}>
                                                    <input
                                                        type="checkbox"
                                                        checked={legacySelectedSystems.includes(s)}
                                                        onChange={() => handleLegacySystemToggle(s)}
                                                    />
                                                    {s}
                                                </label>
                                            ))}
                                            {!legacySystems.length && (
                                                <span className={styles.emptyState}>No systems found.</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.group}>
                                        <div className={styles.groupTitle}>Layers</div>
                                        <AllNone name="lay-allnone" onAll={handleLegacyAllLayers} onNone={handleLegacyNoneLayers}/>
                                        <div className={styles.checklist}>
                                            {legacyLayers.map(l => (
                                                <label key={l} className={styles.item}>
                                                    <input
                                                        type="checkbox"
                                                        checked={legacySelectedLayers.includes(l)}
                                                        onChange={() => handleLegacyLayerToggle(l)}
                                                    />
                                                    {l}
                                                </label>
                                            ))}
                                            {!legacyLayers.length && (
                                                <span className={styles.emptyState}>No layers found.</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.group}>
                                        <div className={styles.groupTitle}>Devices</div>
                                        <AllNone name="dev-allnone" onAll={handleLegacyAllDevices} onNone={handleLegacyNoneDevices}/>
                                        <div className={styles.checklist}>
                                            {legacyDevices.map(d => (
                                                <label key={d} className={styles.item}>
                                                    <input
                                                        type="checkbox"
                                                        checked={legacySelectedDevices.includes(d)}
                                                        onChange={() => handleLegacyDeviceToggle(d)}
                                                    />
                                                    {d}
                                                </label>
                                            ))}
                                            {!legacyDevices.length && (
                                                <span className={styles.emptyState}>No devices found.</span>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={`${styles.treeCard} ${isTreeCollapsed ? styles.treeCollapsed : ''}`}>
                                        <div className={styles.treeHead}>
                                            <div className={styles.groupTitle}>Systems · Layers · Devices</div>
                                            <div className={styles.treeActions}>
                                                {!isTreeCollapsed && (
                                                    <AllNone name="loc-tree" onAll={handleSelectAllLocations} onNone={handleClearLocations}/>
                                                )}
                                                <button
                                                    type="button"
                                                    className={styles.collapseToggle}
                                                    onClick={() => setIsTreeCollapsed(prev => !prev)}
                                                    aria-expanded={!isTreeCollapsed}
                                                    aria-label={isTreeCollapsed ? 'Expand systems list' : 'Collapse systems list'}
                                                >
                                                    {isTreeCollapsed ? 'Expand' : 'Collapse'}
                                                </button>
                                            </div>
                                        </div>
                                        {!isTreeCollapsed && (
                                            <div className={styles.treeList}>
                                                {locationSystems.map(system => {
                                                    const deviceCount = system.layers.reduce((acc, layer) => acc + layer.devices.length, 0);
                                                    const isSystemCollapsed = collapsedSystems.has(system.id);
                                                    return (
                                                        <div key={system.id} className={styles.systemRow}>
                                                            <div className={styles.systemHeader}>
                                                                <div className={styles.systemInfo}>
                                                                    <span className={styles.systemLabel}>{system.label}</span>
                                                                    <span className={styles.badge}>{deviceCount}</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className={styles.collapseToggle}
                                                                    onClick={() => toggleSystemCollapse(system.id)}
                                                                    aria-expanded={!isSystemCollapsed}
                                                                    aria-label={`${isSystemCollapsed ? 'Expand' : 'Collapse'} ${system.label}`}
                                                                >
                                                                    {isSystemCollapsed ? 'Expand' : 'Collapse'}
                                                                </button>
                                                            </div>
                                                            {!isSystemCollapsed && (
                                                                <div className={styles.layerList}>
                                                                    {system.layers.map(layer => {
                                                                        const layerKey = `${system.id}::${layer.id}`;
                                                                        const isLayerCollapsed = collapsedLayers.has(layerKey);
                                                                        return (
                                                                            <div key={`${system.id}-${layer.id}`} className={styles.layerRow}>
                                                                                <div className={styles.layerHeader}>
                                                                                    <div className={styles.layerInfo}>
                                                                                        <span className={styles.layerLabel}>{layer.label}</span>
                                                                                        <span className={styles.badge}>{layer.devices.length}</span>
                                                                                    </div>
                                                                                    <button
                                                                                        type="button"
                                                                                        className={styles.collapseToggle}
                                                                                        onClick={() => toggleLayerCollapse(layerKey)}
                                                                                        aria-expanded={!isLayerCollapsed}
                                                                                        aria-label={`${isLayerCollapsed ? 'Expand' : 'Collapse'} ${layer.label}`}
                                                                                    >
                                                                                        {isLayerCollapsed ? 'Expand' : 'Collapse'}
                                                                                    </button>
                                                                                </div>
                                                                                {!isLayerCollapsed && (
                                                                                    <div className={styles.deviceList}>
                                                                                        {layer.devices.map(device => {
                                                                                            const checked = isCompositeChecked(device.compositeId);
                                                                                            return (
                                                                                                <label
                                                                                                    key={device.compositeId}
                                                                                                    className={`${styles.item} ${styles.deviceItem}`}
                                                                                                >
                                                                                                    <input
                                                                                                        type="checkbox"
                                                                                                        checked={checked}
                                                                                                        onChange={(e) => handleDeviceToggle(device, e.target.checked)}
                                                                                                        aria-label={device.label}
                                                                                                    />
                                                                                                    <span className={styles.deviceLabel}>{device.label}</span>
                                                                                                    <span className={styles.deviceCid}>{device.compositeId}</span>
                                                                                                </label>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={styles.block}>
                        <h4>Select Sensor Type</h4>
                        <div className={styles.sensorGrid}>
                            <Group title="Water Parameters"      name="water" options={water.options||[]} values={water.values} onAll={onAllWater} onNone={onNoneWater} onToggle={onToggleWater}/>
                            <Group title="Air – Light Intensity" name="light" options={light.options||[]} values={light.values} onAll={onAllLight} onNone={onNoneLight} onToggle={onToggleLight}/>
                            <Group title="Air – Blue Spectrum"   name="blue"  options={blue.options||[]}  values={blue.values}  onAll={onAllBlue}  onNone={onNoneBlue}  onToggle={onToggleBlue}/>
                            <Group title="Air – Red Spectrum"    name="red"   options={red.options||[]}   values={red.values}   onAll={onAllRed}   onNone={onNoneRed}   onToggle={onToggleRed}/>
                            <Group title="Air – Quality"         name="airq"  options={airq.options||[]}  values={airq.values}  onAll={onAllAirq}  onNone={onNoneAirq}  onToggle={onToggleAirq}/>
                        </div>
                    </div>

                </aside>

                <section className={styles.content}>
                    <div className={styles.summaryCard}>
                        <div className={styles.summaryRow}>
                            <span className={styles.rangeLabel}>{rangeLabel}</span>
                            <span className={styles.selectionCount}>
                                {selectedCompositeCount} / {totalCompositeCount || 0} device IDs selected
                            </span>
                        </div>
                        {selectedDeviceNames.length > 0 ? (
                            <div className={styles.selectedDevicesRow}>
                                <span className={styles.summaryLabel}>Selected devices</span>
                                <span className={styles.selectedDevicesValue}>{selectedDeviceNames.join(', ')}</span>
                            </div>
                        ) : (
                            <div className={styles.selectedDevicesRow}>
                                <span className={styles.summaryLabel}>Selected devices</span>
                                <span className={styles.noDeviceSelected}>No device selected</span>
                            </div>
                        )}
                        <div className={styles.summaryMeta}>Auto refresh: {autoRefreshValue}</div>
                    </div>

                    {compareItems?.length > 0 && (
                        <div className={styles.compare}>
                            <div className={styles.compareHead}>
                                <strong>Compare List</strong>
                                <button type="button" className={styles.btn} onClick={onClearCompare}>Clear All</button>
                            </div>
                            <div>
                                {compareItems.map((c) => (
                                    <div key={c.id} className={styles.compareItem}>
                                        <div className={styles.compareHead}>
                                            <div className={styles.itemTitle}>{c.title}</div>
                                            <button
                                                type="button"
                                                className={styles.btn}
                                                onClick={() => onRemoveCompare && onRemoveCompare(c.id)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <div className={styles.itemMeta}>
                                            Sensors: {c.sensors?.join(', ') || '-'} | Time: {c.from || '-'} → {c.to || '-'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
