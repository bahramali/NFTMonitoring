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
            {options.map((opt) => (
                <label key={opt} className={styles.item}>
                    <input
                        type="checkbox"
                        checked={values.includes(opt)}
                        onChange={() => onToggle && onToggle(opt)}
                    />
                    {opt}
                </label>
            ))}
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

    const memoSystems = useMemo(() => {
        return Array.from(new Set((catalog?.systems || []).map(s => s.id))).sort();
    }, [catalog]);
    const systems = systemsProp.length ? systemsProp : memoSystems;

    const memoLayers = useMemo(() => {
        return Array.from(new Set((catalog?.devices || []).map(d => d.layerId))).sort();
    }, [catalog]);
    const layers = layersProp.length ? layersProp : memoLayers;

    const memoDevices = useMemo(() => {
        return Array.from(new Set((catalog?.devices || []).map(d => d.deviceId))).sort();
    }, [catalog]);
    const devices = devicesProp.length ? devicesProp : memoDevices;

    const sensorGroups = useMemo(() => {
        const groups = {water: [], light: [], blue: [], red: [], airq: []};
        const sensors = (catalog?.devices || []).flatMap(d => d.sensors || []);
        sensors.forEach(s => {
            const rawName = s?.sensorName || s?.sensorType || s?.valueType || '';
            const name = rawName.toString();
            const lower = name.toLowerCase();
            const add = (grp) => {
                if (!groups[grp].includes(name)) groups[grp].push(name);
            };
            if (['ph', 'tds', 'ec', 'do', 'water'].some(k => lower.includes(k))) add('water');
            if (['lux', 'vis', 'light'].some(k => lower.includes(k))) add('light');
            if (['405', '425', '450', '475', '515'].some(k => lower.includes(k))) add('blue');
            if (['600', '640', '690', '745'].some(k => lower.includes(k))) add('red');
            if (['temp', 'humidity', 'co2', 'voc', 'air'].some(k => lower.includes(k))) add('airq');
        });
        return groups;
    }, [catalog]);

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
                <div className={`${styles.row} ${styles.cols3}`}>
                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Systems</div>
                        <AllNone name="sys-allnone" onAll={() => {
                        }} onNone={() => {
                        }}/>
                        <div className={styles.checklist}>
                            {systems.map(s => (
                                <label key={s} className={styles.item}>
                                    <input type="checkbox" checked={selectedSystem === s}
                                           onChange={() => onSystemChange && onSystemChange({target: {value: s}})}/> {s}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Layers</div>
                        <AllNone name="lay-allnone" onAll={() => {
                        }} onNone={() => {
                        }}/>
                        <div className={styles.checklist}>
                            {layers.map(l => (
                                <label key={l} className={styles.item}>
                                    <input type="checkbox" checked={selectedLayer === l}
                                           onChange={() => onLayerChange && onLayerChange({target: {value: l}})}/> {l}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.group}>
                        <div className={styles.groupTitle}>Devices</div>
                        <AllNone name="dev-allnone" onAll={() => {
                        }} onNone={() => {
                        }}/>
                        <div className={styles.checklist}>
                            {devices.map(d => {
                                const value = typeof d === 'string' ? d : d.value;
                                const label = typeof d === 'string' ? d : (d.label || d.value);
                                return (
                                    <label key={value} className={styles.item}>
                                        <input type="checkbox" checked={selectedDevice === value}
                                               onChange={() => onDeviceChange && onDeviceChange({target: {value}})}/> {label}
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
