import React, {useEffect, useMemo, useRef, useState} from "react";
import ReportCharts from "./components/ReportCharts";
import ReportFiltersCompare from "./components/ReportFiltersCompare";
import {transformAggregatedData} from "../../utils.js";
import Header from "../common/Header";

// helpers
const toCID = (d) => `${d.systemId}-${d.layerId}-${d.deviceId}`;
const toLocalInputValue = (date) => {
    const pad = (n) => `${n}`.padStart(2, "0");
    const y = date.getFullYear(), m = pad(date.getMonth() + 1), d = pad(date.getDate());
    const hh = pad(date.getHours()), mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
};
const toISOSeconds = (v) => (v ? new Date(v).toISOString() : "");
const AUTO_REFRESH_MS = {"30s": 30_000, "1m": 60_000, "5m": 300_000};
const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api.hydroleaf.se";

// English: choose bucket by range. Min resolution is 1m (your sampling rate)
const pickBucket = (fromLocal, toLocal) => {
    const hours = (new Date(toLocal) - new Date(fromLocal)) / 36e5;
    if (hours <= 6) return "1m";
    if (hours <= 24) return "5m";
    if (hours <= 72) return "15m";
    if (hours <= 168) return "30m";  // <= 7 days
    if (hours <= 720) return "1h";   // <= 30 days
    return "2h";
};

function useDevicesMeta() {
    const [meta, setMeta] = useState({devices: []});
    useEffect(() => {
        const cached = localStorage.getItem("reportsMeta:v1") || localStorage.getItem("deviceCatalog");
        if (cached) {
            try { setMeta(JSON.parse(cached)); }
            catch { /* ignore parse errors */ }
        }
    }, []);
    return meta;
}

export default function Reports() {
    const {devices: deviceRows} = useDevicesMeta();

    // timing
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date(); d.setHours(d.getHours() - 6); return toLocalInputValue(d);
    });
    const [toDate, setToDate] = useState(() => toLocalInputValue(new Date()));
    const [autoRefreshValue, setAutoRefreshValue] = useState("Off");

    // location filters
    const [selSystems, setSelSystems] = useState(new Set());
    const [selLayers, setSelLayers] = useState(new Set());
    const [selDevices, setSelDevices] = useState(new Set());
    const [selCIDs, setSelCIDs] = useState(new Set());

    // sensor selections
    const [selSensors, setSelSensors] = useState({
        water: new Set(), light: new Set(), blue: new Set(), red: new Set(), airq: new Set(),
    });
    // toggle helpers
    const toggleSensor = (group, key) =>
        setSelSensors(prev => { const n = new Set(prev[group]); n.has(key) ? n.delete(key) : n.add(key); return { ...prev, [group]: n }; });
    const setAllSensors = (group, keys) => setSelSensors(prev => ({...prev, [group]: new Set(keys)}));
    const clearSensors  = (group) => setSelSensors(prev => ({...prev, [group]: new Set()}));

    // meta lists
    const systems = useMemo(() =>
        Array.from(new Set(deviceRows.map(d => d.systemId))).sort(), [deviceRows]);

    const layers = useMemo(() => {
        const filtered = deviceRows.filter(d => (selSystems.size ? selSystems.has(d.systemId) : true));
        return Array.from(new Set(filtered.map(d => d.layerId))).sort();
    }, [deviceRows, selSystems]);

    const filteredDeviceRows = useMemo(() =>
        deviceRows.filter(d =>
            (selSystems.size ? selSystems.has(d.systemId) : true) &&
            (selLayers.size ? selLayers.has(d.layerId) : true)
        ), [deviceRows, selSystems, selLayers]);

    const deviceIds = useMemo(
        () => Array.from(new Set(filteredDeviceRows.map(d => d.deviceId))).sort(), [filteredDeviceRows]
    );

    // derive CIDs from selections
    useEffect(() => {
        const filtered = deviceRows.filter(d =>
            (selSystems.size ? selSystems.has(d.systemId) : true) &&
            (selLayers.size ? selLayers.has(d.layerId) : true) &&
            (selDevices.size ? selDevices.has(d.deviceId) : true)
        );
        setSelCIDs(new Set(filtered.map(toCID)));
    }, [
        deviceRows,
        Array.from(selSystems).join(","),
        Array.from(selLayers).join(","),
        Array.from(selDevices).join(","),
    ]);

    // fallback to filtered devices if CID list is empty
    const selectedCIDs = useMemo(() => {
        const arr = Array.from(selCIDs);
        return arr.length ? arr : Array.from(new Set(filteredDeviceRows.map(toCID)));
    }, [selCIDs, filteredDeviceRows]);

    // charts data (per CID)
    const [chartData, setChartData] = useState({
        tempByCid: {}, rangeByCid: {}, phByCid: {}, ecTdsByCid: {}, doByCid: {}
    });
    const [error, setError] = useState("");
    const abortRef = useRef(null);

    // child callbacks
    const handleSystemChange = (e) => {
        const v = e.target.value;
        if (v === "ALL") setSelSystems(new Set(systems));
        else if (v === "") setSelSystems(new Set());
        else setSelSystems(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
    };
    const handleLayerChange = (e) => {
        const v = e.target.value;
        if (v === "ALL") setSelLayers(new Set(layers));
        else if (v === "") setSelLayers(new Set());
        else setSelLayers(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
    };
    const handleDeviceChange = (e) => {
        const v = e.target.value;
        if (v === "ALL") setSelDevices(new Set(deviceIds));
        else if (v === "") setSelDevices(new Set());
        else setSelDevices(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
    };

    // fetch data
    const fetchReportData = async () => {
        try {
            setError("");
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            const {signal} = abortRef.current;
            if (!selectedCIDs.length) return;

            const sensorsSelected = [
                ...selSensors.water, ...selSensors.light, ...selSensors.blue, ...selSensors.red, ...selSensors.airq,
            ];
            const autoBucket = pickBucket(fromDate, toDate);
            const baseParams = { from: toISOSeconds(fromDate), to: toISOSeconds(toDate), bucket: autoBucket };

            const requests = [];
            for (const cid of selectedCIDs) {
                const params = new URLSearchParams(baseParams);
                params.set("compositeId", cid);
                if (sensorsSelected.length) for (const s of sensorsSelected) params.append("sensorType", s);
                const url = `${API_BASE}/api/records/history/aggregated?${params.toString()}`;
                requests.push((async () => {
                    const res = await fetch(url, {signal});
                    if (!res.ok) { const txt = await res.text().catch(() => ""); throw new Error(`CID ${cid} -> ${res.status} ${txt}`); }
                    const data = await res.json();
                    return {cid, data};
                })());
            }

            const results = await Promise.all(requests);

            // build per-CID arrays
            const tempByCid = {}, rangeByCid = {}, phByCid = {}, ecTdsByCid = {}, doByCid = {};
            for (const {cid, data} of results) {
                const entries = transformAggregatedData({ sensors: data.sensors || [] });
                const processed = entries.map(d => ({ time: d.timestamp, ...d, lux: d.lux?.value ?? 0 }));
                rangeByCid[cid] = processed;

                tempByCid[cid] = processed.map(d => ({
                    time: d.time,
                    temperature: d.temperature?.value ?? 0,
                    humidity: d.humidity?.value ?? 0,
                }));
                phByCid[cid] = processed.map(d => ({ time: d.time, ph: d.ph?.value ?? 0 }));
                ecTdsByCid[cid] = processed.map(d => ({ time: d.time, ec: d.ec?.value ?? 0, tds: d.tds?.value ?? 0 }));
                doByCid[cid] = processed.map(d => ({ time: d.time, do: d.do?.value ?? 0 }));
            }

            setChartData({ tempByCid, rangeByCid, phByCid, ecTdsByCid, doByCid });
        } catch (e) {
            if (e.name !== "AbortError") { console.error(e); setError(String(e.message || e)); }
        }
    };

    // auto refresh
    const sensorDeps = JSON.stringify([
        ...selSensors.water, ...selSensors.light, ...selSensors.blue, ...selSensors.red, ...selSensors.airq,
    ]);
    useEffect(() => {
        const ms = AUTO_REFRESH_MS[autoRefreshValue];
        if (!ms) return;
        const t = setInterval(fetchReportData, ms);
        return () => clearInterval(t);
    }, [autoRefreshValue, fromDate, toDate, selectedCIDs.join(","), sensorDeps]);

    // compare list
    const [compareItems, setCompareItems] = useState([]);
    const onAddCompare = () => {
        if (!selectedCIDs.length) return;
        const autoBucket = pickBucket(fromDate, toDate);
        const title = `${selectedCIDs[0]} (${autoBucket})`;
        setCompareItems(p => [...p, {
            id: String(Date.now()),
            title,
            from: toISOSeconds(fromDate),
            to:   toISOSeconds(toDate),
            sensors: [...selSensors.water, ...selSensors.light, ...selSensors.blue, ...selSensors.red, ...selSensors.airq],
        }]);
    };
    const onRemoveCompare = (id) => setCompareItems(p => p.filter(x => x.id !== id));
    const onClearCompare  = () => setCompareItems([]);

    const onApply = () => fetchReportData();
    const onReset = () => {
        setSelSystems(new Set());
        setSelLayers(new Set());
        setSelDevices(new Set());
        setSelCIDs(new Set());
        setSelSensors({water:new Set(), light:new Set(), blue:new Set(), red:new Set(), airq:new Set()});
    };

    const xDomain = [new Date(fromDate).getTime(), new Date(toDate).getTime()];
    const selectedDeviceLabel = selectedCIDs.length === 1 ? selectedCIDs[0] : "";

    return (
        <div>
            <Header title="Reports" />
            <div style={{padding: 16}}>
            <ReportFiltersCompare
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={(e) => setFromDate(e.target.value)}
                onToDateChange={(e) => setToDate(e.target.value)}
                onApply={onApply}
                autoRefreshValue={autoRefreshValue}
                onAutoRefreshValueChange={(e) => setAutoRefreshValue(e.target.value)}
                systems={systems}
                layers={layers}
                devices={deviceIds}
                onSystemChange={handleSystemChange}
                onLayerChange={handleLayerChange}
                onDeviceChange={handleDeviceChange}
                onReset={onReset}
                onAddCompare={onAddCompare}
                onExportCsv={() => {}}
                rangeLabel={`From: ${new Date(fromDate).toLocaleString()} until: ${new Date(toDate).toLocaleString()}`}
                compareItems={compareItems}
                onClearCompare={onClearCompare}
                onRemoveCompare={onRemoveCompare}
                water={{values: Array.from(selSensors.water)}}
                light={{values: Array.from(selSensors.light)}}
                blue={{values: Array.from(selSensors.blue)}}
                red={{values: Array.from(selSensors.red)}}
                airq={{values: Array.from(selSensors.airq)}}
                onToggleWater={(k)=>toggleSensor("water", k)}
                onToggleLight={(k)=>toggleSensor("light", k)}
                onToggleBlue={(k)=>toggleSensor("blue",  k)}
                onToggleRed={(k)=>toggleSensor("red",   k)}
                onToggleAirq={(k)=>toggleSensor("airq",  k)}
                onAllWater={(keys)=>setAllSensors("water", keys.map(x=>typeof x==="string"?x:x.label))}
                onNoneWater={()=>clearSensors("water")}
                onAllLight={(keys)=>setAllSensors("light", keys.map(x=>typeof x==="string"?x:x.label))}
                onNoneLight={()=>clearSensors("light")}
                onAllBlue={(keys)=>setAllSensors("blue", keys.map(x=>typeof x==="string"?x:x.label))}
                onNoneBlue={()=>clearSensors("blue")}
                onAllRed={(keys)=>setAllSensors("red", keys.map(x=>typeof x==="string"?x:x.label))}
                onNoneRed={()=>clearSensors("red")}
                onAllAirq={(keys)=>setAllSensors("airq", keys.map(x=>typeof x==="string"?x:x.label))}
                onNoneAirq={()=>clearSensors("airq")}
            />

            {error && <div style={{color:"#b91c1c", marginTop:8, fontSize:14}}>{error}</div>}

            <div style={{marginTop:16}}>
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
                        blue:  Array.from(selSensors.blue),
                        red:   Array.from(selSensors.red),
                        airq:  Array.from(selSensors.airq),
                    }}
                    xDomain={xDomain}
                />
            </div>
            </div>
        </div>
    );
}
