import React from 'react';
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
                                                 systems = ['S01', 'S02'],
                                                 layers = ['L01', 'L02', 'L03'],
                                                 devices = ['G01', 'G02', 'G03'],
                                                 selectedSystem = '',
                                                 onSystemChange,
                                                 selectedLayer = '',
                                                 onLayerChange,
                                                 selectedDevice = '',
                                                 onDeviceChange,
                                                 // sensor groups (UI-only defaults like target design)
                                                 water = {options: ['pH', 'TDS', 'EC', 'DO', 'Water Temp'], values: []},
                                                 light = {options: ['Lux', 'VIS1', 'VIS2'], values: []},
                                                 blue = {
                                                     options: ['405nm', '425nm', '450nm', '475nm', '515nm'],
                                                     values: []
                                                 },
                                                 red = {options: ['600nm', '640nm', '690nm', '745nm'], values: []},
                                                 airq = {options: ['Air Temp', 'Humidity', 'CO₂', 'VOC'], values: []},
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
                            {devices.map(d => (
                                <label key={d} className={styles.item}>
                                    <input type="checkbox" checked={selectedDevice === d}
                                           onChange={() => onDeviceChange && onDeviceChange({target: {value: d}})}/> {d}
                                </label>
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
