import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReportCharts from "./components/ReportCharts";
import ReportFiltersCompare from "./components/ReportFiltersCompare";
import { transformAggregatedData } from "../../utils.js";
import Header from "../common/Header";
import { API_BASE } from "./utils/catalog";
import { pickBucket, toISOSeconds } from "./utils/datetime";
import { useReportsFilters } from "../../context/ReportsFiltersContext.jsx";
import styles from "./ReportsPage.module.css";

const AUTO_REFRESH_MS = { "30s": 30_000, "1m": 60_000, "5m": 300_000 };

const formatTopicLabel = (id) =>
    String(id || "")
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/^\s+|\s+$/g, "")
        .replace(/^./, (ch) => ch.toUpperCase());

const createEmptyChartState = () => ({
    tempByCid: Object.create(null),
    rangeByCid: Object.create(null),
    phByCid: Object.create(null),
    ecTdsByCid: Object.create(null),
    doByCid: Object.create(null),
});

const collectSelectedSensors = (topics, sensorsByTopic) => {
    const aggregated = new Set();
    topics.forEach((topic) => {
        (sensorsByTopic[topic] || new Set()).forEach((label) => aggregated.add(label));
    });
    return Array.from(aggregated);
};

const extractValue = (reading) => reading?.value ?? 0;

const buildChartSeries = (sensorsPayload = []) => {
    const range = [];
    const temperature = [];
    const ph = [];
    const ecTds = [];
    const dissolvedOxygen = [];

    transformAggregatedData({ sensors: sensorsPayload }).forEach((entry) => {
        const time = entry.timestamp;
        const withLux = { ...entry, time, lux: extractValue(entry.lux) };
        range.push(withLux);
        temperature.push({
            time,
            temperature: extractValue(entry.temperature),
            humidity: extractValue(entry.humidity),
        });
        ph.push({ time, ph: extractValue(entry.ph) });
        ecTds.push({
            time,
            ec: extractValue(entry.ec),
            tds: extractValue(entry.tds),
        });
        dissolvedOxygen.push({ time, do: extractValue(entry.do) });
    });

    return { range, temperature, ph, ecTds, dissolvedOxygen };
};

const createHistoryUrl = (cid, params, selectedSensors) => {
    const search = new URLSearchParams(params);
    search.set("compositeId", cid);
    selectedSensors.forEach((sensor) => search.append("sensorType", sensor));
    return `${API_BASE}/api/records/history/aggregated?${search.toString()}`;
};

export default function Reports() {
    const {
        deviceMeta,
        fromDate,
        setFromDate,
        toDate,
        setToDate,
        autoRefreshValue,
        setAutoRefreshValue,
        systems,
        layers,
        deviceIds,
        handleSystemChange,
        handleLayerChange,
        handleDeviceChange,
        onReset,
        onAddCompare,
        onClearCompare,
        onRemoveCompare,
        compareItems,
        selSensors,
        selectedTopics,
        toggleTopicSelection,
        setAllTopics,
        clearTopics,
        availableTopicSensors,
        availableTopicDevices,
        toggleSensor,
        setAllSensors,
        clearSensors,
        selectedCIDs,
        selectedCompositeIds,
        handleCompositeSelectionChange,
        registerApplyHandler,
        triggerApply,
    } = useReportsFilters();

    const topicList = useMemo(() => {
        const entries = Object.entries(availableTopicSensors || {});
        return entries.map(([id, sensors]) => ({ id, label: formatTopicLabel(id), sensors }));
    }, [availableTopicSensors]);

    const topicDeviceOptions = useMemo(() => {
        const entries = Object.entries(availableTopicDevices || {});
        return entries.reduce((acc, [topic, devices]) => {
            acc[topic] = Array.isArray(devices) ? devices : [];
            return acc;
        }, {});
    }, [availableTopicDevices]);

    const selectedSensorsByTopic = useMemo(() => {
        const map = {};
        Object.entries(selSensors || {}).forEach(([topic, values]) => {
            map[topic] = Array.from(values || []);
        });
        return map;
    }, [selSensors]);

    const selectedTopicIds = useMemo(() => Array.from(selectedTopics || []), [selectedTopics]);

    const handleFromDateChange = useCallback(
        ({ target }) => setFromDate(target.value),
        [setFromDate],
    );

    const handleToDateChange = useCallback(
        ({ target }) => setToDate(target.value),
        [setToDate],
    );

    const handleAutoRefreshChange = useCallback(
        ({ target }) => setAutoRefreshValue(target.value),
        [setAutoRefreshValue],
    );

    const handleTopicSensorToggle = useCallback(
        (topic, key) => toggleSensor(topic, key),
        [toggleSensor],
    );

    const handleAllTopicSensors = useCallback(
        (topic, keys) => setAllSensors(topic, keys),
        [setAllSensors],
    );

    const handleNoneTopicSensors = useCallback(
        (topic) => clearSensors(topic),
        [clearSensors],
    );

    const [chartData, setChartData] = useState(() => createEmptyChartState());
    const [error, setError] = useState("");
    const abortRef = useRef(null);

    const selectedSensors = useMemo(
        () => collectSelectedSensors(selectedTopics, selSensors),
        [selectedTopics, selSensors],
    );

    const resetAbortController = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;
        return controller;
    }, []);

    const fetchReportData = useCallback(async () => {
        if (!selectedCIDs.length) {
            if (abortRef.current) {
                abortRef.current.abort();
            }
            setChartData(createEmptyChartState());
            return;
        }

        try {
            setError("");
            const { signal } = resetAbortController();

            const autoBucket = pickBucket(fromDate, toDate);
            const baseParams = { from: toISOSeconds(fromDate), to: toISOSeconds(toDate), bucket: autoBucket };

            const requests = selectedCIDs.map((cid) => {
                return (async () => {
                    const url = createHistoryUrl(cid, baseParams, selectedSensors);
                    console.info("Fetching aggregated history", url);
                    const res = await fetch(url, { signal });
                    if (!res.ok) {
                        const txt = await res.text().catch(() => "");
                        throw new Error(`CID ${cid} -> ${res.status} ${txt}`);
                    }
                    const data = await res.json();
                    return { cid, data };
                })();
            });

            const results = await Promise.all(requests);

            const chartState = results.reduce((state, { cid, data }) => {
                const { range, temperature, ph, ecTds, dissolvedOxygen } = buildChartSeries(data.sensors);
                state.rangeByCid[cid] = range;
                state.tempByCid[cid] = temperature;
                state.phByCid[cid] = ph;
                state.ecTdsByCid[cid] = ecTds;
                state.doByCid[cid] = dissolvedOxygen;
                return state;
            }, createEmptyChartState());

            setChartData(chartState);
        } catch (e) {
            if (e.name !== "AbortError") {
                console.error(e);
                setError(String(e.message || e));
            }
        }
    }, [fromDate, toDate, selectedCIDs, selectedSensors, resetAbortController]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    useEffect(() => {
        registerApplyHandler(fetchReportData);
        return () => registerApplyHandler(undefined);
    }, [registerApplyHandler, fetchReportData]);

    useEffect(
        () => () => {
            if (abortRef.current) abortRef.current.abort();
        },
        [],
    );

    useEffect(() => {
        const ms = AUTO_REFRESH_MS[autoRefreshValue];
        if (!ms) return undefined;
        const interval = setInterval(() => {
            fetchReportData();
        }, ms);
        return () => clearInterval(interval);
    }, [autoRefreshValue, fetchReportData]);

    const xDomain = useMemo(() => {
        const start = Date.parse(fromDate);
        const end = Date.parse(toDate);
        if (Number.isNaN(start) || Number.isNaN(end)) {
            return undefined;
        }
        return [start, end];
    }, [fromDate, toDate]);

    const selectedDeviceLabel = useMemo(
        () => (selectedCIDs.length === 1 ? selectedCIDs[0] : ""),
        [selectedCIDs],
    );

    const rangeLabel = useMemo(() => {
        if (!fromDate || !toDate) return "";
        const fromTime = Date.parse(fromDate);
        const toTime = Date.parse(toDate);
        if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return "";
        const formatter = new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
        return `${formatter.format(fromTime)} — ${formatter.format(toTime)}`;
    }, [fromDate, toDate]);

    const selectionBadgeLabel = useMemo(() => {
        const count = selectedCIDs.length;
        if (!count) return "No devices selected yet";
        return `${count} device${count === 1 ? "" : "s"} selected`;
    }, [selectedCIDs]);

    const autoRefreshLabel = useMemo(() => {
        if (!autoRefreshValue || autoRefreshValue === "Off") return "Auto refresh off";
        return `Auto refresh ${autoRefreshValue}`;
    }, [autoRefreshValue]);

    return (
        <div className={styles.page}>
            <Header title="Reports" />
            <div className={styles.content}>
                <section className={styles.filtersSection}>
                    <div className={styles.filtersIntro}>
                        <div>
                            <h2>Filter your telemetry</h2>
                            <p>
                                Choose the timeframe, devices, and sensor topics to explore performance trends
                                across your hydroponic systems.
                            </p>
                        </div>
                        <div className={styles.filtersBadges}>
                            <span className={styles.badge}>{rangeLabel || "Select a time range"}</span>
                            <span className={`${styles.badge} ${styles.badgeMuted}`}>{selectionBadgeLabel}</span>
                            <span className={`${styles.badge} ${styles.badgeMuted}`}>{autoRefreshLabel}</span>
                        </div>
                    </div>
                    <ReportFiltersCompare
                        variant="page"
                        catalog={deviceMeta}
                        fromDate={fromDate}
                        toDate={toDate}
                        onFromDateChange={handleFromDateChange}
                        onToDateChange={handleToDateChange}
                        onApply={triggerApply}
                        autoRefreshValue={autoRefreshValue}
                        onAutoRefreshValueChange={handleAutoRefreshChange}
                        systems={systems}
                        layers={layers}
                        devices={deviceIds}
                        onSystemChange={handleSystemChange}
                        onLayerChange={handleLayerChange}
                        onDeviceChange={handleDeviceChange}
                        onCompositeSelectionChange={handleCompositeSelectionChange}
                        onReset={onReset}
                        onAddCompare={onAddCompare}
                        rangeLabel={rangeLabel}
                        compareItems={compareItems}
                        onClearCompare={onClearCompare}
                        onRemoveCompare={onRemoveCompare}
                        topics={topicList}
                        selectedTopics={selectedTopicIds}
                        onTopicToggle={toggleTopicSelection}
                        onAllTopics={setAllTopics}
                        onNoneTopics={clearTopics}
                        topicSensors={availableTopicSensors}
                        topicDevices={topicDeviceOptions}
                        selectedTopicSensors={selectedSensorsByTopic}
                        onToggleTopicSensor={handleTopicSensorToggle}
                        onAllTopicSensors={handleAllTopicSensors}
                        onNoneTopicSensors={handleNoneTopicSensors}
                        selectedCompositeIds={selectedCompositeIds}
                    />
                </section>

                <section className={styles.chartsSection}>
                    {error && <div className={styles.errorMessage}>{error}</div>}
                    <ReportCharts
                        tempByCid={chartData.tempByCid}
                        rangeByCid={chartData.rangeByCid}
                        phByCid={chartData.phByCid}
                        ecTdsByCid={chartData.ecTdsByCid}
                        doByCid={chartData.doByCid}
                        selectedDevice={selectedDeviceLabel}
                        selectedSensors={selectedSensors}
                        xDomain={xDomain}
                    />
                </section>
            </div>
        </div>
    );
}
