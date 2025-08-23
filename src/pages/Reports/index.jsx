import React, {useEffect, useMemo, useState} from 'react';
import Header from '../common/Header';
import {useLiveDevices} from '../../components/useLiveDevices.js';
import {useHistory} from '../../components/useHistory.js';
import styles from '../common/SensorDashboard.module.css';
import ReportFiltersCompare from './components/ReportFiltersCompare';
import ReportCharts from './components/ReportCharts';
import {SENSOR_TOPIC, topics} from '../Dashboard/components/dashboard.constants.js';
import {toLocalInputValue, formatTime} from '../Dashboard/components/dashboard.utils.js';
import {useFilters, ALL} from '../../context/FiltersContext';

function Reports() {
    const [activeSystem, setActiveSystem] = useState('S01');
    const {deviceData, availableCompositeIds} = useLiveDevices(topics, activeSystem);
    // Initialize the selected device immediately so that report sections are
    // rendered without a transient "No reports" message. This ensures tests can
    // assert on the initial UI without waiting for effects to run.
    const [selectedDevice, setSelectedDevice] = useState(() => availableCompositeIds[0] || '');

    const now = Date.now();
    const [fromDate, setFromDate] = useState(toLocalInputValue(new Date(now - 6 * 60 * 60 * 1000)));
    const [toDate, setToDate] = useState(toLocalInputValue(new Date(now)));

    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(60000);

    const {
        device: devFilter,
        layer: layerFilter,
        system: sysFilter,
        topic: topicFilter,
        setLists,
    } = useFilters();

    const activeSystemTopics = deviceData[activeSystem] || {};
    const sensorTopicDevices = activeSystemTopics[SENSOR_TOPIC] || {};

    // Build metadata for filtering
    const deviceMeta = useMemo(() => {
        const map = {};
        for (const [sysId, topicsObj] of Object.entries(deviceData || {})) {
            for (const [topicKey, devs] of Object.entries(topicsObj || {})) {
                for (const [cid, payload] of Object.entries(devs || {})) {
                    const baseId = payload?.deviceId;
                    const layer = payload?.layer?.layer || payload?.layer || null;
                    if (!map[cid]) {
                        map[cid] = {system: sysId, layer, baseId, topics: new Set([topicKey])};
                    } else {
                        map[cid].topics.add(topicKey);
                    }
                }
            }
        }
        return Object.fromEntries(
            Object.entries(map).map(([cid, m]) => [cid, {
                system: m.system,
                layer: m.layer,
                baseId: m.baseId,
                topics: Array.from(m.topics)
            }])
        );
    }, [deviceData]);

    // Populate sidebar lists
    useEffect(() => {
        const devices = Object.keys(deviceMeta);
        const layers = Array.from(new Set(Object.values(deviceMeta).map((m) => m.layer).filter(Boolean)));
        const systems = Object.keys(deviceData || {});
        const topicsList = Array.from(new Set(Object.values(deviceData || {}).flatMap((sys) => Object.keys(sys || {}))));
        setLists({devices, layers, systems, topics: topicsList});
    }, [deviceMeta, deviceData, setLists]);

    // Keep activeSystem in sync with filter
    useEffect(() => {
        if (sysFilter !== ALL && sysFilter !== activeSystem) {
            setActiveSystem(sysFilter);
        }
    }, [sysFilter, activeSystem]);

    // If no system is selected and the current system has no devices,
    // automatically switch to the first available system so that reports
    // are shown without extra user interaction.
    useEffect(() => {
        if (
            sysFilter === ALL &&
            (!deviceData[activeSystem] || Object.keys(deviceData[activeSystem] || {}).length === 0)
        ) {
            const systems = Object.keys(deviceData || {});
            if (systems.length && activeSystem !== systems[0]) {
                setActiveSystem(systems[0]);
            }
        }
    }, [deviceData, activeSystem, sysFilter]);

    // Filter available device IDs based on active filters
    const filteredCompositeIds = useMemo(() => {
        return availableCompositeIds.filter((id) => {
            const meta = deviceMeta[id] || {};
            const okDev = devFilter === ALL || id === devFilter;
            const okLay = layerFilter === ALL || meta.layer === layerFilter;
            const okSys = sysFilter === ALL || meta.system === sysFilter;
            const okTopic = topicFilter === ALL || (meta.topics || []).includes(topicFilter);
            return okDev && okLay && okSys && okTopic;
        });
    }, [availableCompositeIds, deviceMeta, devFilter, layerFilter, sysFilter, topicFilter]);

    // Ensure selectedDevice is valid
    useEffect(() => {
        if (filteredCompositeIds.length && !filteredCompositeIds.includes(selectedDevice)) {
            setSelectedDevice(filteredCompositeIds[0]);
        }
    }, [filteredCompositeIds, selectedDevice]);

    const sensorTypesForSelected = useMemo(() => {
        const match = sensorTopicDevices[selectedDevice];
        const sensors = match?.sensors || [];
        return sensors.map((s) => (s.sensorType || s.valueType || '').toLowerCase());
    }, [sensorTopicDevices, selectedDevice]);

    const sensorNamesForSelected = useMemo(() => {
        const match = sensorTopicDevices[selectedDevice];
        const sensors = match?.sensors || [];
        return sensors.map((s) => (s.sensorName || s.source || '-').toLowerCase());
    }, [sensorTopicDevices, selectedDevice]);

    const allSensorNamesTypes = useMemo(() => {
        const set = new Set();
        Object.values(sensorTopicDevices || {}).forEach(dev => {
            (dev.sensors || []).forEach(s => {
                const name = (s.sensorName || s.source || '').toLowerCase();
                const type = (s.sensorType || s.valueType || '').toLowerCase();
                if (name) set.add(name);
                if (type) set.add(type);
            });
        });
        return Array.from(set);
    }, [sensorTopicDevices]);

    // Sensor group classification with disabled state
    const sensorGroups = useMemo(() => {
        const groups = {water: [], light: [], blue: [], red: [], airq: []};
        const activeSet = new Set([...(sensorNamesForSelected || []), ...(sensorTypesForSelected || [])]);
        allSensorNamesTypes.forEach((name) => {
            const lower = name.toLowerCase();
            const disabled = !activeSet.has(name);
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
    }, [allSensorNamesTypes, sensorNamesForSelected, sensorTypesForSelected]);

    const [selectedWater, setSelectedWater] = useState([]);
    const [selectedLight, setSelectedLight] = useState([]);
    const [selectedBlue, setSelectedBlue] = useState([]);
    const [selectedRed, setSelectedRed] = useState([]);
    const [selectedAirq, setSelectedAirq] = useState([]);

    useEffect(() => {
        setSelectedWater([]);
        setSelectedLight([]);
        setSelectedBlue([]);
        setSelectedRed([]);
        setSelectedAirq([]);
    }, [sensorGroups]);

    const selectedSensorTypes = useMemo(() => {
        return Array.from(new Set([
            ...selectedWater,
            ...selectedLight,
            ...selectedBlue,
            ...selectedRed,
            ...selectedAirq,
        ]));
    }, [selectedWater, selectedLight, selectedBlue, selectedRed, selectedAirq]);

    const toggle = (setter) => (opt) => setter(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
    const all = (options, setter) => () =>
        setter(options.filter(o => !o.disabled).map(o => o.label));
    const none = (setter) => () => setter([]);

    const onToggleWater = toggle(setSelectedWater);
    const onToggleLight = toggle(setSelectedLight);
    const onToggleBlue = toggle(setSelectedBlue);
    const onToggleRed = toggle(setSelectedRed);
    const onToggleAirq = toggle(setSelectedAirq);

    const onAllWater = all(sensorGroups.water, setSelectedWater);
    const onAllLight = all(sensorGroups.light, setSelectedLight);
    const onAllBlue = all(sensorGroups.blue, setSelectedBlue);
    const onAllRed = all(sensorGroups.red, setSelectedRed);
    const onAllAirq = all(sensorGroups.airq, setSelectedAirq);

    const onNoneWater = none(setSelectedWater);
    const onNoneLight = none(setSelectedLight);
    const onNoneBlue = none(setSelectedBlue);
    const onNoneRed = none(setSelectedRed);
    const onNoneAirq = none(setSelectedAirq);

    const resetSensors = () => {
        setSelectedWater([]);
        setSelectedLight([]);
        setSelectedBlue([]);
        setSelectedRed([]);
        setSelectedAirq([]);
    };

    const {
        rangeData = [],
        tempRangeData = [],
        phRangeData = [],
        ecTdsRangeData = [],
        doRangeData = [],
        xDomain = [],
        startTime = 0,
        endTime = 0,
        fetchReportData = () => {
        },
    } = useHistory(selectedDevice, fromDate, toDate, autoRefresh, refreshInterval, selectedSensorTypes);

    // Determine which report sections to display based on selected sensor types.
    // If no sensors are explicitly selected, fall back to the full list of sensors
    // available for the device.
    const sensorsForDisplay = useMemo(() => {
        const base = selectedSensorTypes.length
            ? selectedSensorTypes
            : [...sensorNamesForSelected, ...sensorTypesForSelected];
        return base.map((s) => (s || '').toString().toLowerCase());
    }, [selectedSensorTypes, sensorNamesForSelected, sensorTypesForSelected]);

    const hasAs734x = sensorsForDisplay.some((s) => s.includes('as7343') || s.includes('as7341'));
    const showTempHum = sensorsForDisplay.some((s) => s.includes('sht3x') || s.includes('temp') || s.includes('humidity'));
    const showSpectrum = hasAs734x || sensorsForDisplay.some((s) => ['405', '425', '450', '475', '515', '550', '555', '600', '640', '690', '745', 'vis1', 'vis2', 'nir855'].some((k) => s.includes(k)));
    const showClearLux = sensorsForDisplay.some((s) => s.includes('veml7700') || s.includes('lux') || s.includes('light') || s.includes('vis1') || s.includes('vis2')) || hasAs734x;
    const showPh = sensorsForDisplay.some((s) => s.includes('ph'));
    const showEcTds = sensorsForDisplay.some((s) => s.includes('ec') || s.includes('tds'));
    const showDo = sensorsForDisplay.some((s) => s.includes('do') || s.includes('dissolvedoxygen'));
    const showAnyReport = showTempHum || showSpectrum || showClearLux || showPh || showEcTds || showDo;
    // compare state
    const [compareItems, setCompareItems] = useState([]);
    const addToCompare = () => {
        const sensors = selectedSensorTypes.length ? selectedSensorTypes : (sensorNamesForSelected.length ? sensorNamesForSelected : sensorTypesForSelected);
        const title = `${(sensors[0] || 'No-sensor')} @ ${activeSystem||'-'}/${(layerFilter||'-')}/${selectedDevice||'-'}`;
        setCompareItems(prev => [...prev, {
          id: String(Date.now()),
          from: fromDate, to: toDate,
          system: activeSystem, layer: layerFilter !== ALL ? layerFilter : (deviceMeta[selectedDevice]?.layer || '-'),
          device: selectedDevice,
          sensors: sensors,
          title
        }]);
      };
      const removeCompare = (id) => setCompareItems(prev => prev.filter(i => i.id !== id));
      const clearCompare = () => setCompareItems([]);
    return (
        <div className={styles.dashboard}>
            <Header title="Reports"/>

            <div className={styles.section}>
                <div className={styles.sectionBody}>
                    {!showAnyReport ? (
                        <div>No reports available for this composite ID.</div>
                    ) : (
                        <>
                            <ReportFiltersCompare
                               // timing
                               fromDate={fromDate}
                               toDate={toDate}
                               onFromDateChange={(e) => setFromDate(e.target.value)}
                               onToDateChange={(e) => setToDate(e.target.value)}
                               onNow={() => setToDate(toLocalInputValue(new Date()))}
                               onApply={fetchReportData}
                               // location lists from computed metadata
                               systems={Object.keys(deviceData || {})}
                               layers={Array.from(new Set(Object.values(deviceMeta).map(m => m.layer).filter(Boolean)))}
                               devices={filteredCompositeIds.map(id => ({ value: id, label: deviceMeta[id]?.baseId || id }))}
                               selectedSystem={activeSystem}
                               onSystemChange={(e) => setActiveSystem(e.target.value)}
                               selectedLayer={layerFilter !== ALL ? layerFilter : (deviceMeta[selectedDevice]?.layer || '')}

                               onLayerChange={() => {/* optional: wire to FiltersContext if needed */}}
                               selectedDevice={selectedDevice}
                               onDeviceChange={(e) => setSelectedDevice(e.target.value)}
                               // sensors (detected)
                               sensorNames={sensorNamesForSelected}
                               sensorTypes={sensorTypesForSelected}
                               water={{ options: sensorGroups.water, values: selectedWater }}
                               light={{ options: sensorGroups.light, values: selectedLight }}
                               blue={{ options: sensorGroups.blue, values: selectedBlue }}
                               red={{ options: sensorGroups.red, values: selectedRed }}
                               airq={{ options: sensorGroups.airq, values: selectedAirq }}
                               onToggleWater={onToggleWater}
                               onToggleLight={onToggleLight}
                               onToggleBlue={onToggleBlue}
                               onToggleRed={onToggleRed}
                               onToggleAirq={onToggleAirq}
                               onAllWater={onAllWater}
                               onNoneWater={onNoneWater}
                               onAllLight={onAllLight}
                               onNoneLight={onNoneLight}
                               onAllBlue={onAllBlue}
                               onNoneBlue={onNoneBlue}
                               onAllRed={onAllRed}
                               onNoneRed={onNoneRed}
                               onAllAirq={onAllAirq}
                               onNoneAirq={onNoneAirq}
                               onReset={resetSensors}
                               // compare
                               compareItems={compareItems}
                               onAddCompare={addToCompare}
                               onRemoveCompare={removeCompare}
                               onClearCompare={clearCompare}
                               // auto refresh
                               autoRefresh={autoRefresh}
                               onAutoRefreshChange={(e) => setAutoRefresh(e.target.checked)}
                               refreshInterval={refreshInterval}
                               onRefreshIntervalChange={(e) => setRefreshInterval(Number(e.target.value))}
                               rangeLabel={`From: ${formatTime(startTime)} until: ${formatTime(endTime)}`}
                             />

                            <ReportCharts
                                showTempHum={showTempHum}
                                showSpectrum={showSpectrum}
                                showClearLux={showClearLux}
                                showPh={showPh}
                                showEcTds={showEcTds}
                                showDo={showDo}
                                rangeData={rangeData}
                                tempRangeData={tempRangeData}
                                phRangeData={phRangeData}
                                ecTdsRangeData={ecTdsRangeData}
                                doRangeData={doRangeData}
                                xDomain={xDomain}
                                selectedDevice={selectedDevice}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Reports;

