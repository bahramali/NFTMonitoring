import {useCallback, useEffect, useRef, useState} from "react";
import {transformAggregatedData} from "../../utils.js";
import {authFetch, parseApiResponse} from "../../api/http.js";

import { getApiBaseUrl } from '../../config/apiBase.js';
import { describeIdentity } from "../../utils/deviceIdentity.js";

const API_BASE = getApiBaseUrl();

export function useHistory(identity, from, to, autoRefresh, interval, sensorTypes = []) {
    const [rangeData, setRangeData] = useState([]);
    const [tempRangeData, setTempRangeData] = useState([]);
    const [phRangeData, setPhRangeData] = useState([]);
    const [ecTdsRangeData, setEcTdsRangeData] = useState([]);
    const [doRangeData, setDoRangeData] = useState([]);
    const [error, setError] = useState(null);

    const initialStart = Date.parse(from);
    const initialEnd = Date.parse(to);
    const [xDomain, setXDomain] = useState([initialStart, initialEnd]);
    const [startTime, setStartTime] = useState(initialStart);
    const [endTime, setEndTime] = useState(initialEnd);

    const endTimeRef = useRef(endTime);
    const startTimeRef = useRef(startTime);
    useEffect(() => { endTimeRef.current = endTime; }, [endTime]);
    useEffect(() => { startTimeRef.current = startTime; }, [startTime]);

    const createHistoryError = (message, status, cause) => {
        const error = new Error(message);
        if (status !== undefined) error.status = status;
        if (cause) error.cause = cause;
        return error;
    };

    const mapHistoryError = (error) => {
        if (error?.status === 401) {
            return createHistoryError('Session expired, please sign in again', error.status, error);
        }
        if (error?.status === 403) {
            return createHistoryError('Not authorized', error.status, error);
        }
        if (!error?.status) {
            return createHistoryError('Network unavailable', undefined, error);
        }
        return createHistoryError(error?.message || 'History unavailable', error?.status, error);
    };

    const loadHistory = useCallback(async (url) => {
        let response;
        try {
            response = await authFetch(url);
        } catch (error) {
            throw mapHistoryError(error);
        }

        try {
            return await parseApiResponse(response, 'History unavailable');
        } catch (error) {
            throw mapHistoryError(error);
        }
    }, []);

    const fetchReportData = useCallback(async () => {
        const described = describeIdentity(identity || {});
        if (!from || !to || !described.farmId || !described.unitType || !described.unitId || !described.deviceId) return;
        try {
            const fromIso = new Date(from).toISOString();
            const toIso = new Date(to).toISOString();
            const sensors = sensorTypes.length ? sensorTypes : [null];
            const requests = sensors.map(async (sensor) => {
                const params = new URLSearchParams({
                    from: fromIso,
                    to: toIso,
                });
                Object.entries(described).forEach(([key, value]) => {
                    if (value === null || value === undefined || value === "") return;
                    params.set(key, String(value));
                });
                if (sensor) params.append("sensorType", sensor);
                const url = `${API_BASE}/api/records/history/aggregated?${params.toString()}`;
                console.log('Request:', url);
                return loadHistory(url);
            });
            const responses = await Promise.all(requests);
            const merged = { sensors: [] };
            for (const json of responses) {
                if (Array.isArray(json.sensors)) merged.sensors.push(...json.sensors);
            }
            const entries = transformAggregatedData(merged);
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
            setError(null);
        } catch (e) {
            const mappedError = mapHistoryError(e);
            setError(mappedError);
            console.error("Failed to fetch history", mappedError);
        }
    }, [identity, from, to, sensorTypes, loadHistory]);

    const fetchNewData = useCallback(async () => {
        try {
            const fromIso = new Date(endTimeRef.current).toISOString();
            const nowDate = new Date();
            const toIso = nowDate.toISOString();
            const sensors = sensorTypes.length ? sensorTypes : [null];
            const described = describeIdentity(identity || {});
            const requests = sensors.map(async (sensor) => {
                const params = new URLSearchParams({
                    from: fromIso,
                    to: toIso,
                });
                Object.entries(described).forEach(([key, value]) => {
                    if (value === null || value === undefined || value === "") return;
                    params.set(key, String(value));
                });
                if (sensor) params.append("sensorType", sensor);
                const url = `${API_BASE}/api/records/history/aggregated?${params.toString()}`;
                console.log('Request:', url);
                return loadHistory(url);
            });
            const responses = await Promise.all(requests);
            const merged = { sensors: [] };
            for (const json of responses) {
                if (Array.isArray(json.sensors)) merged.sensors.push(...json.sensors);
            }
            const entries = transformAggregatedData(merged);
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
            setError(null);
        } catch (e) {
            const mappedError = mapHistoryError(e);
            setError(mappedError);
            console.error("Failed to fetch history", mappedError);
        }
    }, [identity, sensorTypes, loadHistory]);

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
        error,
        fetchReportData
    };
}
