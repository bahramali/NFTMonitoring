import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReportCharts from "./components/ReportCharts";
import { transformAggregatedData } from "../../utils.js";
import Header from "../common/Header";
import { API_BASE } from "./utils/catalog";
import { pickBucket, toISOSeconds } from "./utils/datetime";
import { useReportsFilters } from "../../context/ReportsFiltersContext.jsx";

const AUTO_REFRESH_MS = { "30s": 30_000, "1m": 60_000, "5m": 300_000 };

const EMPTY_CHART_DATA = {
    tempByCid: {},
    rangeByCid: {},
    phByCid: {},
    ecTdsByCid: {},
    doByCid: {},
};

export default function Reports() {
    const {
        fromDate,
        toDate,
        autoRefreshValue,
        selectedCIDs,
        selSensors,
        registerApplyHandler,
    } = useReportsFilters();

    const [chartData, setChartData] = useState(EMPTY_CHART_DATA);
    const [error, setError] = useState("");
    const abortRef = useRef(null);

    const fetchReportData = useCallback(async () => {
        try {
            setError("");
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            const { signal } = abortRef.current;
            if (!selectedCIDs.length) {
                setChartData(EMPTY_CHART_DATA);
                return;
            }

            const sensorsSelected = [
                ...selSensors.water,
                ...selSensors.light,
                ...selSensors.blue,
                ...selSensors.red,
                ...selSensors.airq,
            ];
            const autoBucket = pickBucket(fromDate, toDate);
            const baseParams = { from: toISOSeconds(fromDate), to: toISOSeconds(toDate), bucket: autoBucket };

            const requests = selectedCIDs.map((cid) => {
                const params = new URLSearchParams(baseParams);
                params.set("compositeId", cid);
                if (sensorsSelected.length) sensorsSelected.forEach((s) => params.append("sensorType", s));
                const url = `${API_BASE}/api/records/history/aggregated?${params.toString()}`;
                return (async () => {
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

            const tempByCid = {}, rangeByCid = {}, phByCid = {}, ecTdsByCid = {}, doByCid = {};
            for (const { cid, data } of results) {
                const entries = transformAggregatedData({ sensors: data.sensors || [] });
                const processed = entries.map((d) => ({ time: d.timestamp, ...d, lux: d.lux?.value ?? 0 }));
                rangeByCid[cid] = processed;

                tempByCid[cid] = processed.map((d) => ({
                    time: d.time,
                    temperature: d.temperature?.value ?? 0,
                    humidity: d.humidity?.value ?? 0,
                }));
                phByCid[cid] = processed.map((d) => ({ time: d.time, ph: d.ph?.value ?? 0 }));
                ecTdsByCid[cid] = processed.map((d) => ({ time: d.time, ec: d.ec?.value ?? 0, tds: d.tds?.value ?? 0 }));
                doByCid[cid] = processed.map((d) => ({ time: d.time, do: d.do?.value ?? 0 }));
            }

            setChartData({ tempByCid, rangeByCid, phByCid, ecTdsByCid, doByCid });
        } catch (e) {
            if (e.name !== "AbortError") {
                console.error(e);
                setError(String(e.message || e));
            }
        }
    }, [fromDate, toDate, selectedCIDs, selSensors]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    useEffect(() => {
        registerApplyHandler(fetchReportData);
        return () => registerApplyHandler(undefined);
    }, [registerApplyHandler, fetchReportData]);

    useEffect(() => () => {
        if (abortRef.current) abortRef.current.abort();
    }, []);

    useEffect(() => {
        const ms = AUTO_REFRESH_MS[autoRefreshValue];
        if (!ms) return undefined;
        const interval = setInterval(() => {
            fetchReportData();
        }, ms);
        return () => clearInterval(interval);
    }, [autoRefreshValue, fetchReportData]);

    const xDomain = useMemo(() => {
        const start = new Date(fromDate).getTime();
        const end = new Date(toDate).getTime();
        return [start, end];
    }, [fromDate, toDate]);

    const selectedDeviceLabel = selectedCIDs.length === 1 ? selectedCIDs[0] : "";

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
                        selectedSensors={{
                            water: Array.from(selSensors.water),
                            light: Array.from(selSensors.light),
                            blue: Array.from(selSensors.blue),
                            red: Array.from(selSensors.red),
                            airq: Array.from(selSensors.airq),
                        }}
                        xDomain={xDomain}
                    />
                </div>
            </div>
        </div>
    );
}
