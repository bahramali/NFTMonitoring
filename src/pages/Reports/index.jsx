import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReportCharts from "./components/ReportCharts";
import { transformAggregatedData } from "../../utils.js";
import Header from "../common/Header";
import { API_BASE } from "./utils/catalog";
import { pickBucket, toISOSeconds } from "./utils/datetime";
import { useReportsFilters } from "../../context/ReportsFiltersContext.jsx";

const AUTO_REFRESH_MS = { "30s": 30_000, "1m": 60_000, "5m": 300_000 };

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
        fromDate,
        toDate,
        autoRefreshValue,
        selectedCIDs,
        selSensors,
        selectedTopics,
        registerApplyHandler,
    } = useReportsFilters();

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

    return (
        <div>
            <Header title="Reports" />
            <div style={{ padding: 16 }}>
                {error && <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 14 }}>{error}</div>}

                <div style={{ marginTop: 16 }}>
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
                </div>
            </div>
        </div>
    );
}
