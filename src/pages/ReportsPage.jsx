import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import { useLiveDevices } from '../components/dashboard/useLiveDevices';
import { useHistory } from '../components/dashboard/useHistory';
import styles from '../components/SensorDashboard.module.css';
import SystemTabs from '../components/dashboard/SystemTabs';
import ReportControls from '../components/dashboard/ReportControls';
import ReportCharts from '../components/dashboard/ReportCharts';
import { SENSOR_TOPIC, topics } from '../components/dashboard/dashboard.constants';
import { toLocalInputValue, formatTime } from '../components/dashboard/dashboard.utils';
import { useFilters, ALL } from '../context/FiltersContext';

function ReportsPage() {
    const [activeSystem, setActiveSystem] = useState('S01');
    const { deviceData, availableCompositeIds } = useLiveDevices(topics, activeSystem);
    const [selectedDevice, setSelectedDevice] = useState('');

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
                        map[cid] = { system: sysId, layer, baseId, topics: new Set([topicKey]) };
                    } else {
                        map[cid].topics.add(topicKey);
                    }
                }
            }
        }
        return Object.fromEntries(
            Object.entries(map).map(([cid, m]) => [cid, { system: m.system, layer: m.layer, baseId: m.baseId, topics: Array.from(m.topics) }])
        );
    }, [deviceData]);

    // Populate sidebar lists
    useEffect(() => {
        const devices = Object.keys(deviceMeta);
        const layers = Array.from(new Set(Object.values(deviceMeta).map((m) => m.layer).filter(Boolean)));
        const systems = Object.keys(deviceData || {});
        const topicsList = Array.from(new Set(Object.values(deviceData || {}).flatMap((sys) => Object.keys(sys || {}))));
        setLists({ devices, layers, systems, topics: topicsList });
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

    // Determine base device ID for history lookup
    const selectedBaseId = useMemo(() => {
        const sysTopics = deviceData[activeSystem] || {};
        for (const topicDevices of Object.values(sysTopics)) {
            if (selectedDevice in topicDevices) {
                return topicDevices[selectedDevice].deviceId || selectedDevice;
            }
        }
        return selectedDevice;
    }, [deviceData, activeSystem, selectedDevice]);

    const {
        rangeData = [],
        tempRangeData = [],
        phRangeData = [],
        ecTdsRangeData = [],
        doRangeData = [],
        xDomain = [],
        startTime = 0,
        endTime = 0,
        fetchReportData = () => {},
    } = useHistory(selectedBaseId, fromDate, toDate, autoRefresh, refreshInterval);

    // Determine which report sections to display
    const sensorTypesForSelected = useMemo(() => {
        const match = sensorTopicDevices[selectedDevice];
        const sensors = match?.sensors || [];
        return sensors.map((s) => (s.type || s.valueType || '').toLowerCase());
    }, [sensorTopicDevices, selectedDevice]);

    const sensorNamesForSelected = useMemo(() => {
        const match = sensorTopicDevices[selectedDevice];
        const sensors = match?.sensors || [];
        return sensors.map((s) => (s.sensorName || s.source || '-').toLowerCase());
    }, [sensorTopicDevices, selectedDevice]);

    const showTempHum = sensorNamesForSelected.includes('sht3x');
    const hasAs734x = sensorNamesForSelected.includes('as7343') || sensorNamesForSelected.includes('as7341');
    const showSpectrum = hasAs734x;
    const showClearLux = sensorNamesForSelected.includes('veml7700') || hasAs734x;
    const showPh = sensorTypesForSelected.includes('ph');
    const showEcTds = sensorTypesForSelected.includes('ec') || sensorTypesForSelected.includes('tds');
    const showDo = sensorTypesForSelected.includes('do') || sensorTypesForSelected.includes('dissolvedoxygen');
    const showAnyReport = showTempHum || showSpectrum || showClearLux || showPh || showEcTds || showDo;

    return (
        <div className={styles.dashboard}>
            <Header system={activeSystem} />

            {/* System selection tabs */}
            <SystemTabs systems={Object.keys(deviceData)} activeSystem={activeSystem} onChange={setActiveSystem} />

            <div className={styles.section}>
                <div className={styles.sectionBody}>
                    {!showAnyReport ? (
                        <div>No reports available for this composite ID.</div>
                    ) : (
                        <>
                            <ReportControls
                                fromDate={fromDate}
                                toDate={toDate}
                                onFromDateChange={(e) => setFromDate(e.target.value)}
                                onToDateChange={(e) => setToDate(e.target.value)}
                                onNow={() => setToDate(toLocalInputValue(new Date()))}
                                onApply={fetchReportData}
                                selectedDevice={selectedDevice}
                                availableCompositeIds={filteredCompositeIds}
                                onDeviceChange={(e) => setSelectedDevice(e.target.value)}
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

export default ReportsPage;

