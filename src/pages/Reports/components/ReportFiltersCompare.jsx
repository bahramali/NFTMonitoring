import React, {useEffect, useMemo, useState} from 'react';
import styles from './ReportFiltersCompare.module.css';

// comment: tiny util to render radio pair
function AllNone({name, onAll, onNone}) {
    return (
        <div className={styles.allnone}>
            <label><input type="radio" name={name} onChange={onAll}/> All</label>
            <label><input type="radio" name={name} onChange={onNone}/> None</label>
        </div>
    );
}

// comment: checklist box
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

// comment: group card with title + radios + checklist
function Group({title, name, options = [], values = [], onAll, onNone, onToggle}) {
    return (
        <div className={styles.group}>
            <div className={styles.groupTitle}>{title}</div>
            <AllNone name={name} onAll={onAll} onNone={onNone}/>
            <Checklist options={options} values={values} onToggle={onToggle}/>
        </div>
    );
}

export default function ReportFiltersCompare({
                                                 // timing
                                                 fromDate,
                                                 toDate,
                                                 onFromDateChange,
                                                 onToDateChange,
                                                 onApply,
                                                 bucket = '5m',
                                                 onBucketChange,
                                                 autoRefreshValue = 'Off',
                                                 onAutoRefreshValueChange,
                                                 // location
                                                 systems: systemsProp = [],
                                                 layers: layersProp = [],
                                                 devices: devicesProp = [],
                                                 selectedSystem = '',
                                                 onSystemChange,
                                                 selectedLayer = '',
                                                 onLayerChange,
                                                 selectedDevice = '',
                                                 onDeviceChange,
                                                 // sensors detected for selected device
                                                 sensorNames = [],
                                                 sensorTypes = [],
                                                 // sensor groups
                                                 water: waterProp,
                                                 light: lightProp,
                                                 blue: blueProp,
                                                 red: redProp,
                                                 airq: airqProp,
                                                 onToggleWater,
                                                 onToggleLight,
                                                 onToggleBlue,
                                                 onToggleRed,
                                                 onToggleAirq,
                                                 onAllWater,
                                                 onNoneWater,
                                                 onAllLight,
                                                 onNoneLight,
                                                 onAllBlue,
                                                 onNoneBlue,
                                                 onAllRed,
                                                 onNoneRed,
                                                 onAllAirq,
                                                 onNoneAirq,
                                                 // compare
                                                 onReset,
                                                 onAddCompare,
                                                 onExportCsv,
                                                 rangeLabel,
                                                 compareItems = [],
                                                 onClearCompare,
                                                 onRemoveCompare,
                                             }) {
    const [catalog, setCatalog] = useState(null);
    // local selection state for multi-select
    const [selectedSystems, setSelectedSystems] = useState(() =>
        selectedSystem ? [selectedSystem] : []
    );
    const [selectedLayers, setSelectedLayers] = useState(() =>
        selectedLayer ? [selectedLayer] : []
    );
    const [selectedDevices, setSelectedDevices] = useState(() =>
        selectedDevice ? [selectedDevice] : []
    );

    const compositeIds = useMemo(() => {
        const systems = catalog?.systems || [];
        const ids = systems.flatMap(sys => {
            const direct = sys.deviceCompositeIds || sys.compositeIds || [];
            const nested = (sys.layers || []).flatMap(lay =>
                (lay.devices || []).map(dev => dev.compositeId).filter(Boolean)
            );
            return [...direct, ...nested];
        });
        if (!ids.length) {
            return (catalog?.devices || []).map(d => `${d.systemId}-${d.layerId}-${d.deviceId}`);
        }
        return Array.from(new Set(ids));
    }, [catalog]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const cached = localStorage.getItem('deviceCatalog');
            if (cached) {
                setCatalog(JSON.parse(cached));
            }
        } catch {
            /* ignore */
        }
    }, []);

    const systemsFromCatalog = useMemo(() => {
        return Array.from(new Set((catalog?.systems || []).map(s => s.id))).sort();
    }, [catalog]);
    const systems = systemsProp.length ? systemsProp : systemsFromCatalog;

    const layersFromCatalog = useMemo(() => {
        return Array.from(new Set((catalog?.devices || [])
            .filter(d => !selectedSystems.length || selectedSystems.includes(d.systemId))
            .map(d => d.layerId))).sort();
    }, [catalog, selectedSystems]);
    const layers = layersProp.length ? layersProp : layersFromCatalog;

    const devicesFromCatalog = useMemo(() => {
        return Array.from(new Set((catalog?.devices || [])
            .filter(d => {
                const sysOk = !selectedSystems.length || selectedSystems.includes(d.systemId);
                const layOk = !selectedLayers.length || selectedLayers.includes(d.layerId);
                return sysOk && layOk;
            })
            .map(d => d.deviceId))).sort();
    }, [catalog, selectedSystems, selectedLayers]);
    const devices = devicesProp.length ? devicesProp : devicesFromCatalog;

    const filteredCatalogDevices = useMemo(() => {
        const all = catalog?.devices || [];
        return all.filter(d => {
            const sysOk = !selectedSystems.length || selectedSystems.includes(d.systemId);
            const layOk = !selectedLayers.length || selectedLayers.includes(d.layerId);
            return sysOk && layOk;
        });
    }, [catalog, selectedSystems, selectedLayers]);

    const selectedCatalogDevices = useMemo(() => {
        if (!selectedDevices.length) return [];
        return filteredCatalogDevices.filter(d =>
            selectedDevices.includes(d.deviceId) ||
            selectedDevices.includes(`${d.layerId}${d.deviceId}`)
        );
    }, [filteredCatalogDevices, selectedDevices]);

    const sensorGroups = useMemo(() => {
        const groups = {water: [], light: [], blue: [], red: [], airq: []};
        let allSensors = filteredCatalogDevices.flatMap(d => d.sensors || []);
        if (!allSensors.length) {
            const fallback = Array.from(new Set([...(sensorNames || []), ...(sensorTypes || [])])).filter(Boolean);
            allSensors = fallback.map((n) => ({ sensorName: n }));
        }
        const activeSensors = selectedCatalogDevices.flatMap(d => d.sensors || []);
        const activeSet = new Set(activeSensors.map(s => (s?.sensorName || s?.sensorType || s?.valueType || '').toString().toLowerCase()));
        allSensors.forEach(s => {
            const rawName = s?.sensorName || s?.sensorType || s?.valueType || '';
            const name = rawName.toString();
            const lower = name.toLowerCase();
            const disabled = !activeSet.has(lower);
            const add = (grp) => {
                if (!groups[grp].some(o => o.label === name)) groups[grp].push({label: name, disabled});
            };
            if (['ph', 'tds', 'ec', 'do', 'water'].some(k => lower.includes(k))) add('water');
            if (['lux', 'vis1','vis2', 'light'].some(k => lower.includes(k))) add('light');
            if (['405', '425', '450', '475', '515'].some(k => lower.includes(k))) add('blue');
            if (['550','555','600', '640', '690', '745'].some(k => lower.includes(k))) add('red');
            if (['temp', 'humidity', 'co2'].some(k => lower.includes(k))) add('airq');
        });
        return groups;
    }, [filteredCatalogDevices, selectedCatalogDevices, sensorNames, sensorTypes]);

    const water = waterProp || {options: sensorGroups.water, values: []};
    const light = lightProp || {options: sensorGroups.light, values: []};
    const blue = blueProp || {options: sensorGroups.blue, values: []};
    const red = redProp || {options: sensorGroups.red, values: []};
    const airq = airqProp || {options: sensorGroups.airq, values: []};

    return (
        <div className={styles.rf}>
            {/* Title */}
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
                        <span className={styles.label}>Bucket</span>
                        <select value={bucket} onChange={onBucketChange}>
                            {['1m', '5m', '15m', '1h', '6h', '1d'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className={styles.field}>
                        <span className={styles.label}>Auto refresh</span>
                        <select value={autoRefreshValue} onChange={onAutoRefreshValueChange}>
                            {['Off', '30s', '1m', '5m'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Location */}
            <div className={styles.block}>
                <h4>Location</h4>
                <div className={`${styles.row} ${styles.cols4}`}>
                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Systems</div>
                        <AllNone name="sys-allnone" onAll={() => {
                            setSelectedSystems(systems);
                            onSystemChange && onSystemChange({target: {value: 'ALL'}});
                        }} onNone={() => {
                            setSelectedSystems([]);
                            onSystemChange && onSystemChange({target: {value: ''}});
                        }}/>
                        <div className={styles.checklist}>
                            {systems.map(s => (
                                <label key={s} className={styles.item}>
                                    <input type="checkbox" checked={selectedSystems.includes(s)}
                                           onChange={() => {
                                               setSelectedSystems(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
                                               onSystemChange && onSystemChange({target: {value: s}});
                                           }}/>
                                    {s}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Layers</div>
                        <AllNone name="lay-allnone" onAll={() => {
                            setSelectedLayers(layers);
                            onLayerChange && onLayerChange({target: {value: 'ALL'}});
                        }} onNone={() => {
                            setSelectedLayers([]);
                            onLayerChange && onLayerChange({target: {value: ''}});
                        }}/>
                        <div className={styles.checklist}>
                            {layers.map(l => (
                                <label key={l} className={styles.item}>
                                    <input type="checkbox" checked={selectedLayers.includes(l)}
                                           onChange={() => {
                                               setSelectedLayers(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
                                               onLayerChange && onLayerChange({target: {value: l}});
                                           }}/>
                                    {l}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Devices</div>
                        <AllNone name="dev-allnone" onAll={() => {
                            const allValues = devices.map(d => typeof d === 'string' ? d : d.value);
                            setSelectedDevices(allValues);
                            onDeviceChange && onDeviceChange({target: {value: 'ALL'}});
                        }} onNone={() => {
                            setSelectedDevices([]);
                            onDeviceChange && onDeviceChange({target: {value: ''}});
                        }}/>
                        <div className={styles.checklist}>
                            {devices.map(d => {
                                const value = typeof d === 'string' ? d : d.value;
                                const label = typeof d === 'string' ? d : (d.label || d.value);
                                return (
                                    <label key={value} className={styles.item}>
                                        <input
                                            type="checkbox"
                                            checked={selectedDevices.includes(value)}
                                            onChange={() => {
                                                setSelectedDevices(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
                                                onDeviceChange && onDeviceChange({target: {value}});
                                            }}
                                        />
                                        {label}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Device Composite IDs</div>
                        <div className={styles.checklist}>
                            {compositeIds.map((id) => (
                                <div key={id} className={styles.item}>{id}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sensor Types */}
            <div className={styles.block}>
                <h4>Select Sensor Type</h4>
                <div className={`${styles.row} ${styles.cols5}`}>
                    <Group title="Water Parameters" name="water" options={water.options} values={water.values}
                           onAll={onAllWater} onNone={onNoneWater} onToggle={onToggleWater}/>
                    <Group title="Air – Light Intensity" name="light" options={light.options} values={light.values}
                           onAll={onAllLight} onNone={onNoneLight} onToggle={onToggleLight}/>
                    <Group title="Air – Blue Spectrum" name="blue" options={blue.options} values={blue.values}
                           onAll={onAllBlue} onNone={onNoneBlue} onToggle={onToggleBlue}/>
                    <Group title="Air – Red Spectrum" name="red" options={red.options} values={red.values}
                           onAll={onAllRed} onNone={onNoneRed} onToggle={onToggleRed}/>
                    <Group title="Air – Quality" name="airq" options={airq.options} values={airq.values}
                           onAll={onAllAirq} onNone={onNoneAirq} onToggle={onToggleAirq}/>
                </div>
            </div>

            {/* Actions */}
            <div className={styles.actionsRight}>
                <button type="button" className={styles.btn} onClick={onApply}>Apply</button>
                <button type="button" className={styles.btn} onClick={onReset}>Reset</button>
                <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onAddCompare}>Add to
                    Compare
                </button>
                <button type="button" className={styles.btn} onClick={onExportCsv}>Export CSV (Table)</button>
            </div>

            {/* Range label */}
            <div className={styles.rangeLabel}>{rangeLabel}</div>

            {/* Divider */}
            <div className={styles.divider}/>

            {/* Compare Panel */}
            {compareItems.length > 0 && (
                <div className={styles.compare}>
                    <div className={styles.compareHead}>
                        <strong>Compare List</strong>
                        <button type="button" className={styles.btn} onClick={onClearCompare}>Clear All</button>
                    </div>
                    <div>
                        {compareItems.map((c, idx) => (
                            <div key={c.id} className={styles.compareItem}>
                                <div className={styles.compareHead}>
                                    <div className={styles.itemTitle}>{idx + 1}. {c.title}</div>
                                    <button type="button" className={styles.btn}
                                            onClick={() => onRemoveCompare && onRemoveCompare(c.id)}>Remove
                                    </button>
                                </div>
                                <div className={styles.itemMeta}>
                                    System: {c.system || '-'} | Layer: {c.layer || '-'} | Device: {c.device || '-'} |
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
