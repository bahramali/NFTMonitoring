import React, {useEffect, useMemo, useState} from 'react';
import styles from './ReportFiltersCompare.module.css';

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
    return (
        <div className={styles.group}>
            <div className={styles.groupTitle}>{title}</div>
            <AllNone name={name} onAll={onAll} onNone={onNone}/>
            <Checklist options={options} values={values} onToggle={onToggle}/>
        </div>
    );
}

const normKey = (s) =>
    (typeof s === 'string'
            ? s
            : (s?.sensorName || s?.sensorType || s?.valueType || '')
    ).toString().toLowerCase();

export default function ReportFiltersCompare(props) {
    const {
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

        onReset, onAddCompare, onExportCsv, rangeLabel,
        compareItems = [], onClearCompare, onRemoveCompare,
    } = props;

    // catalog
    const [catalog, setCatalog] = useState(null);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const a = localStorage.getItem('reportsMeta:v1');
            const b = localStorage.getItem('deviceCatalog');
            const raw = a || b;
            if (raw) setCatalog(JSON.parse(raw));
        } catch {
            /* ignore parse errors */
        }
    }, []);

    // composite IDs
    const compositeIds = useMemo(() => {
        const sys = catalog?.systems || [];
        const ids = sys.flatMap(s =>
            (s.deviceCompositeIds || s.compositeIds || [])
                .concat((s.layers || []).flatMap(l => (l.devices || []).map(d => d.compositeId).filter(Boolean)))
        );
        if (ids.length) return Array.from(new Set(ids));
        return (catalog?.devices || []).map(d => `${d.systemId}-${d.layerId}-${d.deviceId}`);
    }, [catalog]);

    // location lists
    const systemsFromCatalog = useMemo(
        () => Array.from(new Set((catalog?.systems || []).map(s => s.id))).sort(),
        [catalog]
    );
    const systems = systemsProp.length ? systemsProp : systemsFromCatalog;

    const layersFromCatalog = useMemo(() =>
        Array.from(new Set((catalog?.devices || []).map(d => d.layerId))).sort(), [catalog]);
    const layers = layersProp.length ? layersProp : layersFromCatalog;

    const devicesFromCatalog = useMemo(() =>
        Array.from(new Set((catalog?.devices || []).map(d => d.deviceId))).sort(), [catalog]);
    const devices = devicesProp.length ? devicesProp : devicesFromCatalog;

    // controlled selections
    const [selectedSystems, setSelectedSystems] = useState([]);
    const [selectedLayers,  setSelectedLayers]  = useState([]);
    const [selectedDevices, setSelectedDevices] = useState([]);

    const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

    const handleSystemToggle = (id) => {
        setSelectedSystems(prev => {
            const next = toggleIn(prev, id);
            onSystemChange && onSystemChange({ target: { value: id } });
            return next;
        });
    };
    const handleLayerToggle = (id) => {
        setSelectedLayers(prev => {
            const next = toggleIn(prev, id);
            onLayerChange && onLayerChange({ target: { value: id } });
            return next;
        });
    };
    const handleDeviceToggle = (id) => {
        setSelectedDevices(prev => {
            const next = toggleIn(prev, id);
            onDeviceChange && onDeviceChange({ target: { value: id } });
            return next;
        });
    };

    const handleAllSystems = () => {
        setSelectedSystems(prev => {
            systems.forEach(id => {
                if (!prev.includes(id)) {
                    onSystemChange && onSystemChange({ target: { value: id } });
                }
            });
            return [...systems];
        });
    };

    const handleNoneSystems = () => {
        setSelectedSystems(prev => {
            prev.forEach(id => {
                onSystemChange && onSystemChange({ target: { value: id } });
            });
            return [];
        });
    };

    const handleAllLayers  = () => {
        setSelectedLayers(prev => {
            layers.forEach(id => {
                if (!prev.includes(id)) {
                    onLayerChange && onLayerChange({ target: { value: id } });
                }
            });
            return [...layers];
        });
    };

    const handleNoneLayers = () => {
        setSelectedLayers(prev => {
            prev.forEach(id => {
                onLayerChange && onLayerChange({ target: { value: id } });
            });
            return [];
        });
    };

    const handleAllDevices = () => {
        setSelectedDevices(prev => {
            devices.forEach(id => {
                if (!prev.includes(id)) {
                    onDeviceChange && onDeviceChange({ target: { value: id } });
                }
            });
            return [...devices];
        });
    };

    const handleNoneDevices= () => {
        setSelectedDevices(prev => {
            prev.forEach(id => {
                onDeviceChange && onDeviceChange({ target: { value: id } });
            });
            return [];
        });
    };

    // filtered catalog devices according to location selection
    const filteredCatalogDevices = useMemo(() => {
        const all = catalog?.devices || [];
        return all.filter(d => {
            const sysOk = !selectedSystems.length || selectedSystems.includes(d.systemId);
            const layOk = !selectedLayers.length  || selectedLayers.includes(d.layerId);
            const devOk = !selectedDevices.length || selectedDevices.includes(d.deviceId);
            return sysOk && layOk && devOk;
        });
    }, [catalog, selectedSystems, selectedLayers, selectedDevices]);

    // composite checkbox state derived from location selection
    const isCompositeChecked = (cid) => {
        const [s, l, d] = cid.split('-');
        return selectedSystems.includes(s) &&
            selectedLayers.includes(l) &&
            selectedDevices.includes(d);
    };


    // sensors: before any location selection, everything disabled (tests expect this)
    const hasAnyLocationSelection =
        selectedSystems.length > 0 || selectedLayers.length > 0 || selectedDevices.length > 0;
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

    // English: clicking a composite id should also select related location checkboxes
    const handleCompositeToggle = (cid, checked) => {
        const [s, l, d] = cid.split("-");
        setSelectedSystems(prev => checked ? Array.from(new Set([...prev, s])) : prev.filter(x => x !== s));
        setSelectedLayers(prev  => checked ? Array.from(new Set([...prev, l])) : prev.filter(x => x !== l));
        setSelectedDevices(prev => checked ? Array.from(new Set([...prev, d])) : prev.filter(x => x !== d));
        onSystemChange && onSystemChange({ target: { value: s } });
        onLayerChange  && onLayerChange({ target: { value: l } });
        onDeviceChange && onDeviceChange({ target: { value: d } });
    };

    return (
        <div className={styles.rf}>
            <div className={styles.title}>Filters</div>

            {/* Timing */}
            <div className={styles.block}>
                <h4>Timing</h4>
                <div className={`${styles.row} ${styles.cols4}`}>
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
                            {['Off','30s','1m','5m'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Location */}
            <div className={styles.block}>
                <h4>Location</h4>
                <div className={`${styles.row} ${styles.cols4}`}>
                    {/* Systems */}
                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Systems</div>
                        <AllNone name="sys-allnone" onAll={handleAllSystems} onNone={handleNoneSystems}/>
                        <div className={styles.checklist}>
                            {systems.map(s => (
                                <label key={s} className={styles.item}>
                                    <input type="checkbox" checked={selectedSystems.includes(s)} onChange={() => handleSystemToggle(s)} />
                                    {s}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Layers */}
                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Layers</div>
                        <AllNone name="lay-allnone" onAll={handleAllLayers} onNone={handleNoneLayers}/>
                        <div className={styles.checklist}>
                            {layers.map(l => (
                                <label key={l} className={styles.item}>
                                    <input type="checkbox" checked={selectedLayers.includes(l)} onChange={() => handleLayerToggle(l)} />
                                    {l}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Devices */}
                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Devices</div>
                        <AllNone name="dev-allnone" onAll={handleAllDevices} onNone={handleNoneDevices}/>
                        <div className={styles.checklist}>
                            {devices.map(d => (
                                <label key={d} className={styles.item}>
                                    <input type="checkbox" checked={selectedDevices.includes(d)} onChange={() => handleDeviceToggle(d)} />
                                    {d}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Composite IDs */}
                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Device Composite IDs</div>
                        <div className={styles.checklist}>
                            {compositeIds.map(id => {
                                const checked = isCompositeChecked(id);
                                return (
                                    <label key={id} className={styles.item}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => handleCompositeToggle(id, e.target.checked)}
                                        />
                                        {id}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sensor Types */}
            <div className={styles.block}>
                <h4>Select Sensor Type</h4>
                <div className={`${styles.row} ${styles.cols5}`}>
                    <Group title="Water Parameters"      name="water" options={water.options||[]} values={water.values} onAll={onAllWater} onNone={onNoneWater} onToggle={onToggleWater}/>
                    <Group title="Air – Light Intensity" name="light" options={light.options||[]} values={light.values} onAll={onAllLight} onNone={onNoneLight} onToggle={onToggleLight}/>
                    <Group title="Air – Blue Spectrum"   name="blue"  options={blue.options||[]}  values={blue.values}  onAll={onAllBlue}  onNone={onNoneBlue}  onToggle={onToggleBlue}/>
                    <Group title="Air – Red Spectrum"    name="red"   options={red.options||[]}   values={red.values}   onAll={onAllRed}   onNone={onNoneRed}   onToggle={onToggleRed}/>
                    <Group title="Air – Quality"         name="airq"  options={airq.options||[]}  values={airq.values}  onAll={onAllAirq}  onNone={onNoneAirq}  onToggle={onToggleAirq}/>
                </div>
            </div>

            {/* Actions */}
            <div className={styles.actionsRight}>
                <button type="button" className={styles.btn} onClick={onApply}>Apply</button>
                <button type="button" className={styles.btn} onClick={onReset}>Reset</button>
                <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onAddCompare}>Add to Compare</button>
                <button type="button" className={styles.btn} onClick={onExportCsv}>Export CSV (Table)</button>
            </div>

            {/* Range label */}
            <div className={styles.rangeLabel}>{rangeLabel}</div>

            {/* Compare list (optional) */}
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
                                    <button type="button" className={styles.btn} onClick={() => onRemoveCompare && onRemoveCompare(c.id)}>Remove</button>
                                </div>
                                <div className={styles.itemMeta}>
                                    Sensors: {c.sensors?.join(', ') || '-'} | Time: {c.from || '-'} → {c.to || '-'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
