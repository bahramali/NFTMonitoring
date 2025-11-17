import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ReportFiltersCompare.module.css";
import { normalizeDeviceCatalog } from "../utils/catalog";
import { ensureString } from "../utils/strings";

function AllNone({name, onAll, onNone}) {
    return (
        <div className={styles.allnone}>
            <label><input type="radio" name={name} onChange={onAll}/> All</label>
            <label><input type="radio" name={name} onChange={onNone}/> None</label>
        </div>
    );
}

const SENSOR_GROUPS = [
    {
        id: "blue",
        label: "blue light",
        values: ["405nm", "425nm", "450nm", "475nm", "515nm"],
    },
    {
        id: "red",
        label: "red light",
        values: ["550nm", "555nm", "600nm", "640nm", "690nm", "745nm", "855nm", "NIR855"],
    },
];

const SENSOR_GROUPS_BY_ID = new Map(SENSOR_GROUPS.map((group) => [group.id, group]));

const SENSOR_GROUP_BY_VALUE = (() => {
    const lookup = new Map();
    SENSOR_GROUPS.forEach((group) => {
        group.values.forEach((value) => {
            lookup.set(value, group);
        });
    });
    return lookup;
})();

const resolveSensorGroupLabel = (value) => {
    const group = SENSOR_GROUP_BY_VALUE.get(value);
    return group?.label ?? null;
};

const resolveSensorLabel = (value, fallback) => resolveSensorGroupLabel(value) ?? fallback;

const resolveOptionValue = (opt) => {
    if (opt === null || opt === undefined) return "";
    if (typeof opt === "string") return opt;
    return opt.value ?? opt.id ?? opt.label ?? "";
};

const normalizeSensorOptions = (options) => {
    const result = [];
    const groupEntries = new Map();

    options.forEach((opt) => {
        if (!opt) return;
        const value = resolveOptionValue(opt);
        const normalized = ensureString(value);
        if (!normalized) return;

        const sourceLabel = typeof opt === "string" ? opt : opt.label ?? normalized;
        const disabled = typeof opt === "string" ? false : !!opt.disabled;
        const group = SENSOR_GROUP_BY_VALUE.get(normalized);

        if (group) {
            if (!groupEntries.has(group.id)) {
                groupEntries.set(group.id, {
                    type: "group",
                    groupId: group.id,
                    label: group.label,
                    value: group.label,
                    presentValues: new Set(),
                    disabledCount: 0,
                    total: 0,
                });
                result.push(groupEntries.get(group.id));
            }
            const entry = groupEntries.get(group.id);
            entry.presentValues.add(normalized);
            entry.total += 1;
            if (disabled) {
                entry.disabledCount += 1;
            }
            return;
        }

        result.push({ label: sourceLabel, value: normalized, disabled });
    });

    return result.map((opt) => {
        if (opt?.type === "group") {
            const group = SENSOR_GROUPS_BY_ID.get(opt.groupId);
            const values = group?.values ?? Array.from(opt.presentValues);
            const uniqueValues = Array.from(new Set(values.map((v) => ensureString(v)).filter(Boolean)));
            return {
                label: group?.label ?? opt.label,
                value: group?.label ?? opt.value,
                sensorValues: uniqueValues,
                disabled: opt.total > 0 ? opt.disabledCount >= opt.total : false,
            };
        }
        return opt;
    });
};

function ChecklistItem({ option, values = [], onToggle }) {
    const checkboxRef = useRef(null);
    const list = Array.isArray(values) ? values : [];
    const value = resolveOptionValue(option);
    const label = typeof option === "string" ? option : option.label ?? value;
    const disabled = typeof option === "string" ? false : !!option.disabled;
    const sensorValues = Array.isArray(option?.sensorValues) ? option.sensorValues : null;
    const isGroup = Array.isArray(sensorValues) && sensorValues.length > 0;
    const allSelected = isGroup ? sensorValues.every((sensor) => list.includes(sensor)) : list.includes(value);
    const partiallySelected =
        isGroup && !allSelected && sensorValues.some((sensor) => list.includes(sensor));

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = partiallySelected;
        }
    }, [partiallySelected]);

    const handleChange = () => {
        if (!onToggle) return;
        if (isGroup) {
            onToggle({ type: "group", values: sensorValues, shouldSelect: !allSelected });
        } else {
            onToggle(value);
        }
    };

    const checkedProp = onToggle ? allSelected : undefined;
    const defaultCheckedProp = !onToggle ? allSelected : undefined;

    return (
        <label className={`${styles.item} ${disabled ? styles.disabled : ""}`}>
            <input
                ref={checkboxRef}
                type="checkbox"
                disabled={disabled}
                aria-checked={partiallySelected ? "mixed" : undefined}
                checked={checkedProp}
                defaultChecked={defaultCheckedProp}
                onChange={handleChange}
            />
            {label}
        </label>
    );
}

function Checklist({options = [], values = [], onToggle}) {
    return (
        <div className={styles.checklist}>
            {options.map((opt) => {
                const value = resolveOptionValue(opt);
                if (!value) return null;
                const normalizedLabel = typeof opt === 'string' ? opt : opt.label ?? value;
                const label = resolveSensorLabel(value, normalizedLabel);
                const option =
                    typeof opt === 'object' && opt !== null
                        ? { ...opt, label }
                        : { label, value };
                return <ChecklistItem key={value} option={option} values={values} onToggle={onToggle}/>;
            })}
        </div>
    );
}

function Group({title, name, options = [], values = [], onAll, onNone, onToggle}) {
    const handleAll = () => onAll && onAll(options);
    const handleToggle = (payload) => {
        if (!onToggle) return;
        onToggle(payload);
    };
    return (
        <div className={styles.group}>
            <div className={styles.groupTitle}>{title}</div>
            <AllNone name={name} onAll={handleAll} onNone={onNone}/>
            <Checklist options={options} values={values} onToggle={handleToggle}/>
        </div>
    );
}

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
        fromDate, toDate, onFromDateChange, onToDateChange, onApply,
        autoRefreshValue = 'Off',
        onAutoRefreshValueChange = () => {},

        devices: devicesProp = [],

        onSystemChange, onLayerChange, onDeviceChange,
        onCompositeSelectionChange,

        topics: topicsProp = [],
        selectedTopics: selectedTopicsProp = [],
        onTopicToggle,
        onAllTopics = () => {},
        onNoneTopics = () => {},
        topicSensors: topicSensorsProp = {},
        topicDevices: topicDevicesProp = {},
        selectedTopicSensors: selectedTopicSensorsProp = {},
        selectedCompositeIds: selectedCompositeIdsProp = [],
        onToggleTopicSensor,
        onAllTopicSensors,
        onNoneTopicSensors,

        rangeLabel,
        compareItems = [], onClearCompare, onRemoveCompare,
        onReset,
        onAddCompare,
        catalog: catalogProp,
    } = props;

    const catalog = useMemo(() => normalizeDeviceCatalog(catalogProp), [catalogProp]);
    const topics = useMemo(() => (Array.isArray(topicsProp) ? topicsProp : []), [topicsProp]);
    const selectedTopics = useMemo(
        () => new Set(Array.isArray(selectedTopicsProp) ? selectedTopicsProp : []),
        [selectedTopicsProp],
    );
    const topicSensors = useMemo(() => {
        const map = {};
        topics.forEach((topic) => {
            const arr = Array.isArray(topicSensorsProp?.[topic.id]) ? topicSensorsProp[topic.id] : [];
            map[topic.id] = normalizeSensorOptions(
                arr
                    .map((item) => {
                        if (!item) return null;
                        if (typeof item === "string") {
                            return { label: resolveSensorLabel(item, item), value: item };
                        }
                        const value = resolveOptionValue(item);
                        if (!value) return null;
                        return { label: resolveSensorLabel(value, item.label ?? value), value, disabled: item.disabled };
                    })
                    .filter(Boolean),
            );
        });
        return map;
    }, [topics, topicSensorsProp]);
    const topicDevices = useMemo(() => {
        const map = {};
        Object.entries(topicDevicesProp || {}).forEach(([topic, devices]) => {
            map[topic] = Array.isArray(devices) ? devices : [];
        });
        return map;
    }, [topicDevicesProp]);
    const selectedTopicSensors = useMemo(() => {
        const map = {};
        Object.entries(selectedTopicSensorsProp || {}).forEach(([topic, values]) => {
            map[topic] = Array.isArray(values) ? values : Array.from(values || []);
        });
        return map;
    }, [selectedTopicSensorsProp]);
    const selectedTopicId = useMemo(() => {
        if (!selectedTopics.size) return null;
        const iterator = selectedTopics.values();
        const first = iterator.next();
        return first?.value || null;
    }, [selectedTopics]);

    const devicesForSelectedTopic = useMemo(
        () => (selectedTopicId ? topicDevices[selectedTopicId] || [] : []),
        [selectedTopicId, topicDevices],
    );

    const locationData = useMemo(() => {
        const compositeMeta = new Map();

        const recordDevice = ({
            systemId,
            systemLabel,
            layerId,
            layerLabel,
            deviceId,
            deviceLabel,
            compositeId,
        }) => {
            const cid = ensureString(compositeId);
            if (!cid) return;

            const parsed = parseCompositeId(cid);
            const sysId = ensureString(systemId, parsed.systemId);
            const layId = ensureString(layerId, parsed.layerId);
            const devId = ensureString(deviceId, parsed.deviceId || cid);
            if (!sysId || !layId || !devId) return;

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
        };

        const catalogDevices = Array.isArray(catalog?.devices) ? catalog.devices : [];
        catalogDevices.forEach((device) => {
            const systemId = ensureString(device.systemId ?? device.system?.id);
            const layerId = ensureString(device.layerId ?? device.layer?.id);
            const deviceId = ensureString(device.deviceId ?? device.id ?? device.device?.id);
            const compositeId = ensureString(
                device.compositeId ?? toFallbackComposite(systemId, layerId, deviceId),
            );

            recordDevice({
                systemId,
                systemLabel: ensureString(device.systemName ?? device.system?.name, systemId),
                layerId,
                layerLabel: ensureString(device.layerName ?? device.layer?.name, layerId),
                deviceId,
                deviceLabel: ensureString(device.deviceName ?? device.name ?? device.label, deviceId),
                compositeId,
            });
        });

        if (!compositeMeta.size) {
            const catalogSystems = Array.isArray(catalog?.systems) ? catalog.systems : [];
            catalogSystems.forEach((system) => {
                const systemId = ensureString(
                    system.id ?? system.systemId ?? system.code ?? system.key,
                );
                if (!systemId) return;
                const systemLabel = ensureString(
                    system.name ?? system.systemName ?? system.label,
                    systemId,
                );

                if (Array.isArray(system.layers)) {
                    system.layers.forEach((layer) => {
                        const layerId = ensureString(
                            layer.id ?? layer.layerId ?? layer.code ?? layer.key,
                        );
                        const layerLabel = ensureString(
                            layer.name ?? layer.layerName ?? layer.label,
                            layerId,
                        );
                        const devices = Array.isArray(layer.devices) ? layer.devices : [];
                        devices.forEach((device) => {
                            const parsed = parseCompositeId(device.compositeId ?? device.id);
                            const deviceId = ensureString(
                                device.deviceId ?? device.id ?? parsed.deviceId,
                            );
                            const compositeId = ensureString(
                                device.compositeId ??
                                    device.id ??
                                    toFallbackComposite(
                                        systemId,
                                        layerId || parsed.layerId,
                                        deviceId,
                                    ),
                            );
                            recordDevice({
                                systemId,
                                systemLabel,
                                layerId: layerId || parsed.layerId,
                                layerLabel: ensureString(layerLabel, layerId || parsed.layerId),
                                deviceId,
                                deviceLabel: ensureString(device.name ?? device.label, deviceId),
                                compositeId,
                            });
                        });
                    });
                }

                const compositeCandidates = [
                    ...(Array.isArray(system.deviceCompositeIds)
                        ? system.deviceCompositeIds
                        : []),
                    ...(Array.isArray(system.compositeIds) ? system.compositeIds : []),
                ];
                compositeCandidates.forEach((cid) => {
                    const parsed = parseCompositeId(cid);
                    recordDevice({
                        systemId,
                        systemLabel,
                        layerId: parsed.layerId || "Layer",
                        layerLabel: ensureString(parsed.layerId, parsed.layerId || "Layer"),
                        deviceId: parsed.deviceId || cid,
                        deviceLabel: parsed.deviceId || cid,
                        compositeId: cid,
                    });
                });
            });
        }

        if (!compositeMeta.size && Array.isArray(devicesProp) && devicesProp.length) {
            devicesProp.forEach((raw) => {
                const cid = ensureString(raw);
                if (!cid || !cid.includes("-")) return;
                const parsed = parseCompositeId(cid);
                recordDevice({
                    systemId: parsed.systemId || "System",
                    systemLabel: parsed.systemId || "System",
                    layerId: parsed.layerId || "Layer",
                    layerLabel: parsed.layerId || "Layer",
                    deviceId: parsed.deviceId || cid,
                    deviceLabel: parsed.deviceId || cid,
                    compositeId: cid,
                });
            });
        }

        return { compositeIds: Array.from(compositeMeta.keys()).sort(), compositeMeta };
    }, [catalog, devicesProp]);

    const { compositeIds, compositeMeta } = locationData;

    const [selectedCompositeIds, setSelectedCompositeIds] = useState(
        () => new Set(Array.isArray(selectedCompositeIdsProp) ? selectedCompositeIdsProp : [])
    );

    const syncCompositeSelection = useCallback((source = []) => {
        setSelectedCompositeIds((prev) => {
            const next = new Set(source);
            if (prev.size === next.size) {
                let identical = true;
                prev.forEach((cid) => {
                    if (!next.has(cid)) {
                        identical = false;
                    }
                });
                if (identical) return prev;
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (!selectedTopicId) {
            syncCompositeSelection([]);
            return;
        }
        const allowed = new Set(devicesForSelectedTopic.map((device) => device?.compositeId).filter(Boolean));
        const raw = Array.isArray(selectedCompositeIdsProp) ? selectedCompositeIdsProp : [];
        const filtered = raw.filter((cid) => allowed.has(cid));
        syncCompositeSelection(filtered);
    }, [selectedCompositeIdsProp, selectedTopicId, devicesForSelectedTopic, syncCompositeSelection]);

    useEffect(() => {
        if (typeof onCompositeSelectionChange === 'function') {
            onCompositeSelectionChange(Array.from(selectedCompositeIds));
        }
    }, [selectedCompositeIds, onCompositeSelectionChange]);
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
    const isApplyDisabled = selectedCompositeCount === 0;

    const selectedCompositeCount = selectedCompositeIds.size;
    const totalCompositeCount = selectedTopicId
        ? (topicDevices[selectedTopicId] || []).length
        : compositeIds.length;

    const isApplyDisabled = selectedCompositeCount === 0;

    const selectedCompositeCount = selectedCompositeIds.size;
    const totalCompositeCount = selectedTopicId
        ? (topicDevices[selectedTopicId] || []).length
        : compositeIds.length;

    const isShowChartsDisabled = selectedCompositeCount === 0;

    const selectedCompositeCount = selectedCompositeIds.size;
    const totalCompositeCount = selectedTopicId
        ? (topicDevices[selectedTopicId] || []).length
        : compositeIds.length;

    const isSelectionEmpty = selectedCompositeCount === 0;

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

    const prevSystemsRef = useRef(selectedSystems);
    useEffect(() => {
        syncParentSelection(prevSystemsRef.current, selectedSystems, onSystemChange);
        prevSystemsRef.current = selectedSystems;
    }, [selectedSystems, onSystemChange]);

    const prevLayersRef = useRef(selectedLayers);
    useEffect(() => {
        syncParentSelection(prevLayersRef.current, selectedLayers, onLayerChange);
        prevLayersRef.current = selectedLayers;
    }, [selectedLayers, onLayerChange]);

    const prevDevicesRef = useRef(selectedDevices);
    useEffect(() => {
        syncParentSelection(prevDevicesRef.current, selectedDevices, onDeviceChange);
        prevDevicesRef.current = selectedDevices;
    }, [selectedDevices, onDeviceChange]);

    const mutateCompositeSelection = (mutator) => {
        setSelectedCompositeIds((prev) => {
            const next = new Set(prev);
            mutator(next, prev);
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
        if (selectedTopicId) {
            const allForTopic = devicesForSelectedTopic
                .map((device) => device?.compositeId)
                .filter(Boolean);
            syncCompositeSelection(allForTopic);
            return;
        }
        syncCompositeSelection(compositeIds);
    };

    const handleClearLocations = () => {
        syncCompositeSelection([]);
    };

    // composite checkbox state derived from location selection
    const isCompositeChecked = (cid) => selectedCompositeIds.has(cid);


    const deviceLabelMap = useMemo(() => {
        const map = new Map();
        Object.values(topicDevices).forEach((devices = []) => {
            devices.forEach((device) => {
                const cid = ensureString(device?.compositeId);
                if (!cid || map.has(cid)) return;
                const label = ensureString(device?.label) || ensureString(device?.deviceId) || cid;
                map.set(cid, label);
            });
        });
        compositeMeta.forEach((meta, cid) => {
            if (!map.has(cid)) {
                const label = meta?.labels?.device || cid;
                if (label) map.set(cid, label);
            }
        });
        return map;
    }, [topicDevices, compositeMeta]);

    const selectedDeviceNames = useMemo(() => {
        if (!selectedCompositeIds.size) return [];
        const names = new Set();
        selectedCompositeIds.forEach((cid) => {
            const label = deviceLabelMap.get(cid) || cid;
            if (label) names.add(label);
        });
        return Array.from(names);
    }, [selectedCompositeIds, deviceLabelMap]);

    const selectedTopicLabel = useMemo(() => {
        if (!selectedTopicId) return "No topic selected";
        const topic = topics.find((entry) => entry.id === selectedTopicId);
        return topic?.label || selectedTopicId;
    }, [selectedTopicId, topics]);

    const dateSummary = useMemo(() => {
        if (ensureString(rangeLabel)) return rangeLabel;
        const from = ensureString(fromDate) || "—";
        const to = ensureString(toDate) || "—";
        return `${from} → ${to}`;
    }, [fromDate, toDate, rangeLabel]);

    const devicePreview = useMemo(() => {
        if (!selectedDeviceNames.length) return [];
        const preview = selectedDeviceNames.slice(0, 3);
        const remainder = selectedDeviceNames.length - preview.length;
        if (remainder > 0) {
            preview.push(`+${remainder} more`);
        }
        return preview;
    }, [selectedDeviceNames]);

    const handleResetClick = useCallback(() => {
        if (typeof onReset === "function") {
            onReset();
        }
    }, [onReset]);

    const handleAddCompareClick = useCallback(() => {
        if (typeof onAddCompare === "function") {
            onAddCompare();
        }
    }, [onAddCompare]);

    const handleApplyClick = useCallback(() => {
        if (typeof onApply === "function") {
            onApply();
        }
    }, [onApply]);

    const selectionCountText = useMemo(() => {
        const total = totalCompositeCount || 0;
        return `${selectedCompositeCount} of ${total}`;
    }, [selectedCompositeCount, totalCompositeCount]);

    const containerClassName = [styles.rf, styles.rfPage, className || ""]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={containerClassName}>
            <div className={styles.titleRow}>
                <div className={styles.title}>Filters</div>
                <div className={`${styles.actionsBlock} ${styles.titleActions}`}>
                    <button type="button" className={styles.btn} onClick={handleResetClick}>
                        Reset
                    </button>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.primary}`}
                        onClick={handleApplyClick}
                    >
                        Refresh data
                    </button>
                    <button
                        type="button"
                        className={styles.btn}
                        onClick={handleAddCompareClick}
                        disabled={isSelectionEmpty}
                    >
                        Add to compare
                    </button>
                </div>
            </div>
            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Date range</span>
                    <span className={styles.summaryValue}>{dateSummary}</span>
                </div>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Topic</span>
                    <span className={styles.summaryValue}>{selectedTopicLabel}</span>
                </div>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Device IDs</span>
                    <span className={styles.summaryValue}>{selectionCountText}</span>
                </div>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Auto refresh</span>
                    <span className={styles.summaryValue}>{ensureString(autoRefreshValue) || "Off"}</span>
                </div>
                <div className={`${styles.summaryItem} ${styles.summaryDevices}`}>
                    <span className={styles.summaryLabel}>Selected devices</span>
                    {devicePreview.length ? (
                        <div className={styles.summaryChips}>
                            {devicePreview.map((chip) => (
                                <span key={chip} className={styles.summaryChip} title={chip}>
                                    {chip}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className={styles.summaryMuted}>No device selected</span>
                    )}
                </div>
                <div className={`${styles.summaryItem} ${styles.summaryActions}`}>
                    <span className={styles.summaryHint}>Confirm to update charts with the current selection.</span>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.primary}`}
                        onClick={handleApplyClick}
                        disabled={isSelectionEmpty}
                    >
                        Show charts
                    </button>
                </div>
            </div>
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
                        <h4>Topics</h4>
                        <div className={styles.sidebarFieldset}>
                            <AllNone name="topics-allnone" onAll={onAllTopics} onNone={onNoneTopics} />
                            <div className={styles.radioList}>
                                {topics.map((topic) => (
                                    <label key={topic.id} className={styles.radioItem}>
                                        <input
                                            type="radio"
                                            name="report-topic"
                                            value={topic.id}
                                            checked={selectedTopicId === topic.id}
                                            onChange={() => onTopicToggle && onTopicToggle(topic.id)}
                                        />
                                        <span className={styles.radioLabel}>{topic.label}</span>
                                    </label>
                                ))}
                                {!topics.length && (
                                    <span className={styles.emptyState}>No topics available.</span>
                                )}
                            </div>
                        </div>
                    </div>

                </aside>

                <section className={styles.content}>
                    <div className={styles.topicDevicesPanel}>
                        <h3>Select Device IDs</h3>
                        {!selectedTopicId ? (
                            <p className={styles.emptyState}>Select a topic to load available devices.</p>
                        ) : devicesForSelectedTopic.length === 0 ? (
                            <p className={styles.emptyState}>No devices available for the selected topic.</p>
                        ) : (
                            <>
                                <div className={styles.deviceActions}>
                                    <button type="button" className={styles.btn} onClick={handleSelectAllLocations}>
                                        Select all
                                    </button>
                                    <button type="button" className={styles.btn} onClick={handleClearLocations}>
                                        Clear
                                    </button>
                                </div>
                                <div className={styles.deviceChecklist}>
                                    {devicesForSelectedTopic.map((device) => {
                                        const compositeId = ensureString(device?.compositeId);
                                        if (!compositeId) return null;
                                        return (
                                            <label key={compositeId} className={styles.deviceOption}>
                                                <input
                                                    type="checkbox"
                                                    checked={isCompositeChecked(compositeId)}
                                                    onChange={(event) =>
                                                        handleDeviceToggle({ ...device, compositeId }, event.target.checked)
                                                    }
                                                />
                                                <span className={styles.deviceInfo}>
                                                    <span className={styles.deviceLabel}>{device?.label || device?.deviceId || compositeId}</span>
                                                    <span className={styles.deviceCid}>{compositeId}</span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <div className={styles.topicSensorsPanel}>
                        <h3>Select Sensor Types</h3>
                        {!selectedTopicId ? (
                            <p className={styles.emptyState}>Choose a topic to see available sensor types.</p>
                        ) : (
                            <div className={styles.sensorGrid}>
                                {(() => {
                                    const options = topicSensors[selectedTopicId] || [];
                                    const values = selectedTopicSensors[selectedTopicId] || [];
                                    const topicMeta = topics.find((topic) => topic.id === selectedTopicId);
                                    return (
                                        <Group
                                            key={selectedTopicId}
                                            title={topicMeta?.label || selectedTopicId}
                                            name={`topic-${selectedTopicId}`}
                                            options={options}
                                            values={values}
                                            onAll={(opts) => onAllTopicSensors && onAllTopicSensors(selectedTopicId, opts)}
                                            onNone={() => onNoneTopicSensors && onNoneTopicSensors(selectedTopicId)}
                                            onToggle={(payload) =>
                                                onToggleTopicSensor && onToggleTopicSensor(selectedTopicId, payload)
                                            }
                                        />
                                    );
                                })()}
                            </div>
                        )}
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
