import {useCallback, useEffect, useRef, useState} from "react";
import {transformAggregatedData} from "../../utils";

export function useHistory(compositeId, from, to, autoRefresh, interval) {
    const [rangeData, setRangeData] = useState([]);
    const [tempRangeData, setTempRangeData] = useState([]);
    const [phRangeData, setPhRangeData] = useState([]);
    const [ecTdsRangeData, setEcTdsRangeData] = useState([]);
    const [doRangeData, setDoRangeData] = useState([]);

    const initialStart = Date.parse(from);
    const initialEnd = Date.parse(to);
    const [xDomain, setXDomain] = useState([initialStart, initialEnd]);
    const [startTime, setStartTime] = useState(initialStart);
    const [endTime, setEndTime] = useState(initialEnd);

    const endTimeRef = useRef(endTime);
    const startTimeRef = useRef(startTime);
    useEffect(() => { endTimeRef.current = endTime; }, [endTime]);
    useEffect(() => { startTimeRef.current = startTime; }, [startTime]);

    const fetchReportData = useCallback(async () => {
        if (!from || !to || !compositeId) return;
        try {
            const fromIso = new Date(from).toISOString();
            const toIso = new Date(to).toISOString();
            const url = `https://api.hydroleaf.se/api/records/history/aggregated?compositeId=${compositeId}&from=${fromIso}&to=${toIso}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("bad response");
            const json = await res.json();
            const entries = transformAggregatedData(json);
            const processed = entries.map(d => ({
                time: d.timestamp,
                ...d,
                lux: d.lux?.value ?? 0
            }));
            setRangeData(processed);
            setTempRangeData(processed.map(d => ({
                time: d.time,
                temperature: d.temperature?.value ?? 0,
                humidity: d.humidity?.value ?? 0
            })));
            setPhRangeData(processed.map(d => ({time: d.time, ph: d.ph?.value ?? 0})));
            setEcTdsRangeData(processed.map(d => ({time: d.time, ec: d.ec?.value ?? 0, tds: d.tds?.value ?? 0})));
            setDoRangeData(processed.map(d => ({time: d.time, do: d.do?.value ?? 0})));

            const start = Date.parse(fromIso);
            const end = Date.parse(toIso);
            setXDomain([start, end]);
            setStartTime(start);
            setEndTime(end);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    }, [compositeId, from, to]);

    const fetchNewData = useCallback(async () => {
        try {
            const fromIso = new Date(endTimeRef.current).toISOString();
            const nowDate = new Date();
            const toIso = nowDate.toISOString();
            const url = `https://api.hydroleaf.se/api/records/history/aggregated?compositeId=${compositeId}&from=${fromIso}&to=${toIso}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("bad response");
            const json = await res.json();
            const entries = transformAggregatedData(json);
            const processed = entries
                .map(d => ({time: d.timestamp, ...d, lux: d.lux?.value ?? 0}))
            .filter(d => d.time > endTimeRef.current);

            if (processed.length) {
                setRangeData(prev => [...prev, ...processed]);
                setTempRangeData(prev => [...prev, ...processed.map(d => ({
                    time: d.time,
                    temperature: d.temperature?.value ?? 0,
                    humidity: d.humidity?.value ?? 0
                }))]);
                setPhRangeData(prev => [...prev, ...processed.map(d => ({time: d.time, ph: d.ph?.value ?? 0}))]);
                setEcTdsRangeData(prev => [...prev, ...processed.map(d => ({
                    time: d.time,
                    ec: d.ec?.value ?? 0,
                    tds: d.tds?.value ?? 0
                }))]);
                setDoRangeData(prev => [...prev, ...processed.map(d => ({time: d.time, do: d.do?.value ?? 0}))]);
            }
            const newEnd = nowDate.getTime();
            setXDomain([startTimeRef.current, newEnd]);
            setEndTime(newEnd);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    }, [compositeId]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    useEffect(() => {
        if (!autoRefresh) return;
        fetchNewData();
        const id = setInterval(fetchNewData, interval);
        return () => clearInterval(id);
    }, [autoRefresh, interval, fetchNewData]);

    return {
        rangeData,
        tempRangeData,
        phRangeData,
        ecTdsRangeData,
        doRangeData,
        xDomain,
        startTime,
        endTime,
        fetchReportData
    };
}

