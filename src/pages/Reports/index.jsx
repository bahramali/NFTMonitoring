import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReportCharts from "./components/ReportCharts";
import ReportFiltersCompare from "./components/ReportFiltersCompare";
import { transformAggregatedData } from "../../utils.js";
import Header from "../common/Header";
import { API_BASE } from "./utils/catalog";
import { pickBucket, toISOSeconds } from "./utils/datetime";
import { useReportsFilters } from "./context/ReportsFiltersContext.jsx";
import { authFetch } from "../../api/http.js";
import styles from "./ReportsPage.module.css";
import { describeIdentity } from "../../utils/deviceIdentity.js";

const AUTO_REFRESH_MS = { "5s": 5_000, "30s": 30_000, "1m": 60_000, "5m": 300_000 };

const createEmptyChartState = () => ({
    tempByCid: Object.create(null),
    rangeByCid: Object.create(null),
    phByCid: Object.create(null),
    ecTdsByCid: Object.create(null),
    doByCid: Object.create(null),
    co2ByCid: Object.create(null),
});

const extractValue = (reading) => reading?.value ?? 0;

const buildChartSeries = (sensorsPayload = []) => {
    const range = [];
    const temperature = [];
    const ph = [];
    const ecTds = [];
    const dissolvedOxygen = [];
    const co2 = [];

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
        co2.push({ time, co2: extractValue(entry.co2) });
    });

    return { range, temperature, ph, ecTds, dissolvedOxygen, co2 };
};

const createHistoryUrl = (identity, params, selectedSensors) => {
    const search = new URLSearchParams(params);
    const described = describeIdentity(identity || {});
    Object.entries(described).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") return;
        search.set(key, String(value));
    });
    if (!search.has("kind")) {
        search.set("kind", "telemetry");
    }
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
        topics,
        selectedTopicIds,
        selectedTopicSensors,
        selectedSensorTypes,
        toggleTopicSelection,
        setAllTopics,
        clearTopics,
        availableTopicSensors,
        availableTopicDevices,
        toggleSensor,
        setAllSensors,
        addSensors,
        removeSensors,
        clearSensors,
        selectedDeviceFilters,
        selectedDeviceKeys,
        handleDeviceSelectionChange,
        deviceIdentityMap,
        registerApplyHandler,
        triggerApply,
    } = useReportsFilters();

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
        (topic, payload) => {
            if (!topic || !payload) return;
            if (typeof payload === "object" && payload.type === "group") {
                const sensors = Array.isArray(payload.values) ? payload.values : [];
                if (!sensors.length) return;
                if (payload.shouldSelect) {
                    addSensors(topic, sensors);
                } else {
                    removeSensors(topic, sensors);
                }
                return;
            }
            toggleSensor(topic, payload);
        },
        [addSensors, removeSensors, toggleSensor],
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
    const [hasAppliedFilters, setHasAppliedFilters] = useState(false);
    const abortRef = useRef(null);

    const resetAbortController = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;
        return controller;
    }, []);

    const fetchReportData = useCallback(async () => {
        if (!selectedDeviceFilters.length) {
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

            const requests = selectedDeviceFilters.map((deviceKey) => {
                return (async () => {
                    const identity = deviceIdentityMap.get(deviceKey);
                    if (!identity) {
                        throw new Error(`Device not found for key ${deviceKey}`);
                    }
                    const url = createHistoryUrl(identity, baseParams, selectedSensorTypes);
                    const res = await authFetch(url, { signal });
                    if (!res.ok) {
                        const txt = await res.text().catch(() => "");
                        throw new Error(`Device ${deviceKey} -> ${res.status} ${txt}`);
                    }
                    const data = await res.json();
                    return { deviceKey, data };
                })();
            });

            const results = await Promise.all(requests);

            const chartState = results.reduce((state, { deviceKey, data }) => {
                const { range, temperature, ph, ecTds, dissolvedOxygen, co2 } = buildChartSeries(data.sensors);
                state.rangeByCid[deviceKey] = range;
                state.tempByCid[deviceKey] = temperature;
                state.phByCid[deviceKey] = ph;
                state.ecTdsByCid[deviceKey] = ecTds;
                state.doByCid[deviceKey] = dissolvedOxygen;
                state.co2ByCid[deviceKey] = co2;
                return state;
            }, createEmptyChartState());

            setChartData(chartState);
        } catch (e) {
            if (e.name !== "AbortError") {
                console.error(e);
                setError(String(e.message || e));
            }
        }
    }, [fromDate, toDate, selectedDeviceFilters, selectedSensorTypes, resetAbortController, deviceIdentityMap]);

    const handleApply = useCallback(() => {
        setHasAppliedFilters(true);
        return fetchReportData();
    }, [fetchReportData]);

    useEffect(() => {
        registerApplyHandler(handleApply);
        return () => registerApplyHandler(undefined);
    }, [registerApplyHandler, handleApply]);

    useEffect(
        () => () => {
            if (abortRef.current) abortRef.current.abort();
        },
        [],
    );

    useEffect(() => {
        if (!hasAppliedFilters) return undefined;
        const ms = AUTO_REFRESH_MS[autoRefreshValue];
        if (!ms) return undefined;
        const interval = setInterval(() => {
            fetchReportData();
        }, ms);
        return () => clearInterval(interval);
    }, [autoRefreshValue, fetchReportData, hasAppliedFilters]);

    const xDomain = useMemo(() => {
        const start = Date.parse(fromDate);
        const end = Date.parse(toDate);
        if (Number.isNaN(start) || Number.isNaN(end)) {
            return undefined;
        }
        return [start, end];
    }, [fromDate, toDate]);

    const selectedDeviceLabel = useMemo(
        () => (selectedDeviceFilters.length === 1 ? selectedDeviceFilters[0] : ""),
        [selectedDeviceFilters],
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
        const count = selectedDeviceFilters.length;
        if (!count) return "No devices selected yet";
        return `${count} device${count === 1 ? "" : "s"} selected`;
    }, [selectedDeviceFilters]);

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
                        onDeviceSelectionChange={handleDeviceSelectionChange}
                        onReset={onReset}
                        onAddCompare={onAddCompare}
                        rangeLabel={rangeLabel}
                        compareItems={compareItems}
                        onClearCompare={onClearCompare}
                        onRemoveCompare={onRemoveCompare}
                        topics={topics}
                        selectedTopics={selectedTopicIds}
                        onTopicToggle={toggleTopicSelection}
                        onAllTopics={setAllTopics}
                        onNoneTopics={clearTopics}
                        topicSensors={availableTopicSensors}
                        topicDevices={availableTopicDevices}
                        selectedTopicSensors={selectedTopicSensors}
                        onToggleTopicSensor={handleTopicSensorToggle}
                        onAllTopicSensors={handleAllTopicSensors}
                        onNoneTopicSensors={handleNoneTopicSensors}
                        selectedDeviceKeys={selectedDeviceKeys}
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
                        co2ByCid={chartData.co2ByCid}
                        selectedDevice={selectedDeviceLabel}
                        selectedSensors={selectedSensorTypes}
                        xDomain={xDomain}
                    />
                </section>
            </div>
        </div>
    );
}
