import React, { useEffect, useMemo, useRef, useState } from "react";
import ReportCharts from "./components/ReportCharts";
import ReportFiltersCompare from "./components/ReportFiltersCompare";
import { transformAggregatedData } from "../../utils.js";

const toCID = (d) => `${d.systemId}-${d.layerId}-${d.deviceId}`;
const toLocalInputValue = (date) => {
    const pad = (n) => `${n}`.padStart(2, "0");
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
};
const toISOSeconds = (v) => (v ? new Date(v).toISOString() : "");
const AUTO_REFRESH_MS = { '30s': 30_000, '1m': 60_000, '5m': 300_000 };

function useDevicesMeta() {
    const [meta, setMeta] = useState({ devices: [] });

    useEffect(() => {
        const cached = localStorage.getItem("reportsMeta:v1") || localStorage.getItem("deviceCatalog");
        if (cached) {
            try { setMeta(JSON.parse(cached)); } catch { /* ignore */ }
        }
        // comment: refresh here if you have an API
        // fetch("/api/meta/devices").then(r=>r.json()).then(d=>{ localStorage.setItem("reportsMeta:v1", JSON.stringify(d)); setMeta(d); });
    }, []);

    return meta;
}

export default function Reports() {
    const { devices: deviceRows } = useDevicesMeta();

    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() - 6);
        return toLocalInputValue(d);
    });
    const [toDate, setToDate] = useState(() => toLocalInputValue(new Date()));
    const [bucket, setBucket] = useState("5m");
    const [autoRefreshValue, setAutoRefreshValue] = useState("Off");

    const [selSystems, setSelSystems]   = useState(new Set());
    const [selLayers, setSelLayers]     = useState(new Set());
    const [selDevices, setSelDevices]   = useState(new Set());
    const [selCIDs, setSelCIDs]         = useState(new Set());

    // ---------- sensor selections (per group) ----------
    // comment: values are EXACT keys e.g., dissolvedEC, 405nm, humidity, light, ...
    const [selSensors, setSelSensors] = useState({
        water: new Set(),   // dissolvedTemp, dissolvedEC, dissolvedTDS, dissolvedOxygen, (pH if available)
        light: new Set(),   // VIS1, VIS2, NIR855, light
        blue:  new Set(),   // 405nm, 425nm, ...
        red:   new Set(),   // 550nm, 600nm, ...
        airq:  new Set(),   // humidity, temperature, CO2
    });

    const toggleSensor = (group, key) => {
        setSelSensors(prev => {
            const n = new Set(prev[group]);
            n.has(key) ? n.delete(key) : n.add(key);
            return { ...prev, [group]: n };
        });
    };
    const setAllSensors = (group, keys) => setSelSensors(prev => ({ ...prev, [group]: new Set(keys) }));
    const clearSensors  = (group) => setSelSensors(prev => ({ ...prev, [group]: new Set() }));

    const systems = useMemo(
        () => Array.from(new Set(deviceRows.map((d) => d.systemId))).sort(),
        [deviceRows]
    );

    const layers = useMemo(() => {
        const filtered = deviceRows.filter((d) =>
            selSystems.size ? selSystems.has(d.systemId) : true
        );
        return Array.from(new Set(filtered.map((d) => d.layerId))).sort();
    }, [deviceRows, selSystems]);

    const filteredDeviceRows = useMemo(
        () =>
            deviceRows.filter(
                (d) =>
                    (selSystems.size ? selSystems.has(d.systemId) : true) &&
                    (selLayers.size ? selLayers.has(d.layerId) : true)
            ),
        [deviceRows, selSystems, selLayers]
    );

    const deviceIds = useMemo(
        () => Array.from(new Set(filteredDeviceRows.map((d) => d.deviceId))).sort(),
        [filteredDeviceRows]
    );

    useEffect(() => {
        const filtered = deviceRows.filter(
            (d) =>
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

    const selectedCIDs = useMemo(() => {
        const arr = Array.from(selCIDs);
        return arr.length ? arr : Array.from(new Set(filteredDeviceRows.map(toCID)));
    }, [selCIDs, filteredDeviceRows]);
    const [error, setError] = useState("");
    const abortRef = useRef(null);

    // comment: datasets kept here (simple structure — replace with real data structure if API exists)
    const [chartData, setChartData] = useState({
        tempRangeData: [],   // for HistoricalTemperatureChart
        phRangeData:   [],   // for HistoricalPhChart (if pH is available)
        ecTdsRangeData:[],   // for HistoricalEcTdsChart
        doRangeData:   [],   // for HistoricalDoChart
        rangeData:     [],   // for MultiBand / ClearLux (if needed)
    });

    const fetchReportData = async () => {
        try {
            setError("");
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            const { signal } = abortRef.current;

            if (!selectedCIDs.length) return;
            // selected sensor union — to send to the API
            const sensorsSelected = [
                ...selSensors.water,
                ...selSensors.light,
                ...selSensors.blue,
                ...selSensors.red,
                ...selSensors.airq,
            ];
            // If no sensors are selected, you can leave this empty so the API returns its default
            const sensorsParam = sensorsSelected.join(',');

            const baseParams = {
                from: toISOSeconds(fromDate),
                to:   toISOSeconds(toDate),
                bucket,
            };

            const requests = selectedCIDs.map(async (cid) => {
                const params = new URLSearchParams(baseParams);
                params.set("compositeId", cid);
                if (sensorsParam) params.set("sensors", sensorsParam); // comment: if the backend supports it
                const url = `/api/records/history/aggregate?${params.toString()}`;
                const res = await fetch(url, { signal });
                if (!res.ok) {
                    const txt = await res.text().catch(() => "");
                    throw new Error(`CID ${cid} -> ${res.status} ${txt}`);
                }
                const data = await res.json();
                return { cid, data };
            });

            const results = await Promise.all(requests);

            let allProcessed = [];
            for (const { data } of results) {
                const entries = transformAggregatedData(data);
                const processed = entries.map((d) => ({
                    time: d.timestamp,
                    ...d,
                    lux: d.lux?.value ?? 0,
                }));
                allProcessed = allProcessed.concat(processed);
            }

            setChartData({
                rangeData: allProcessed,
                tempRangeData: allProcessed.map((d) => ({
                    time: d.time,
                    temperature: d.temperature?.value ?? 0,
                    humidity: d.humidity?.value ?? 0,
                })),
                phRangeData: allProcessed.map((d) => ({
                    time: d.time,
                    ph: d.ph?.value ?? 0,
                })),
                ecTdsRangeData: allProcessed.map((d) => ({
                    time: d.time,
                    ec: d.ec?.value ?? 0,
                    tds: d.tds?.value ?? 0,
                })),
                doRangeData: allProcessed.map((d) => ({
                    time: d.time,
                    do: d.do?.value ?? 0,
                })),
            });
        } catch (e) {
            if (e.name !== "AbortError") {
                console.error(e);
                setError(String(e.message || e));
            }
        }
    };

    const sensorDeps = JSON.stringify([
        ...selSensors.water,
        ...selSensors.light,
        ...selSensors.blue,
        ...selSensors.red,
        ...selSensors.airq,
    ]);

    useEffect(() => {
        const ms = AUTO_REFRESH_MS[autoRefreshValue];
        if (!ms) return;
        const t = setInterval(fetchReportData, ms);
        return () => clearInterval(t);
    }, [autoRefreshValue, fromDate, toDate, bucket, selectedCIDs.join(','), sensorDeps]);

    // ---------- compare (same as before) ----------
    const [compareItems, setCompareItems] = useState([]);
    const onAddCompare = () => {
        if (!selectedCIDs.length) return;
        const title = `${selectedCIDs[0]} (${bucket})`;
        setCompareItems((p) => [
            ...p,
            {
                id: String(Date.now()),
                title,
                from: toISOSeconds(fromDate),
                to:   toISOSeconds(toDate),
                sensors: [
                    ...selSensors.water, ...selSensors.light,
                    ...selSensors.blue,  ...selSensors.red, ...selSensors.airq,
                ],
            },
        ]);
    };
    const onRemoveCompare = (id) => setCompareItems((p) => p.filter((x) => x.id !== id));
    const onClearCompare  = () => setCompareItems([]);

    const onApply = () => fetchReportData();
    const onReset = () => {
        setSelSystems(new Set());
        setSelLayers(new Set());
        setSelDevices(new Set());
        setSelCIDs(new Set());
        setSelSensors({ water:new Set(), light:new Set(), blue:new Set(), red:new Set(), airq:new Set() });
    };

    const xDomain = [new Date(fromDate).getTime(), new Date(toDate).getTime()];
    const selectedDeviceLabel = selectedCIDs.length === 1 ? selectedCIDs[0] : "";

    return (
        <div style={{ padding: 16 }}>
            <ReportFiltersCompare
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={(e) => setFromDate(e.target.value)}
                onToDateChange={(e) => setToDate(e.target.value)}
                onApply={onApply}
                bucket={bucket}
                onBucketChange={(e) => setBucket(e.target.value)}
                autoRefreshValue={autoRefreshValue}
                onAutoRefreshValueChange={(e) => setAutoRefreshValue(e.target.value)}
                systems={systems}
                layers={layers}
                devices={deviceIds}
                onReset={onReset}
                onAddCompare={onAddCompare}
                onExportCsv={() => {}}
                rangeLabel={`From: ${new Date(fromDate).toLocaleString()} until: ${new Date(toDate).toLocaleString()}`}
                compareItems={compareItems}
                onClearCompare={onClearCompare}
                onRemoveCompare={onRemoveCompare}

                // sensors — only values and handlers (the component builds options from the catalog)
                water={{ values: Array.from(selSensors.water) }}
                light={{ values: Array.from(selSensors.light) }}
                blue={{  values: Array.from(selSensors.blue)  }}
                red={{   values: Array.from(selSensors.red)   }}
                airq={{  values: Array.from(selSensors.airq)  }}
                onToggleWater={(k)=>toggleSensor('water', k)}
                onToggleLight={(k)=>toggleSensor('light', k)}
                onToggleBlue={(k)=>toggleSensor('blue',  k)}
                onToggleRed={(k)=>toggleSensor('red',   k)}
                onToggleAirq={(k)=>toggleSensor('airq',  k)}
                onAllWater={(keys)=>setAllSensors('water', keys.map(x=>typeof x==='string'?x:x.label))}
                onNoneWater={()=>clearSensors('water')}
                onAllLight={(keys)=>setAllSensors('light', keys.map(x=>typeof x==='string'?x:x.label))}
                onNoneLight={()=>clearSensors('light')}
                onAllBlue={(keys)=>setAllSensors('blue', keys.map(x=>typeof x==='string'?x:x.label))}
                onNoneBlue={()=>clearSensors('blue')}
                onAllRed={(keys)=>setAllSensors('red', keys.map(x=>typeof x==='string'?x:x.label))}
                onNoneRed={()=>clearSensors('red')}
                onAllAirq={(keys)=>setAllSensors('airq', keys.map(x=>typeof x==='string'?x:x.label))}
                onNoneAirq={()=>clearSensors('airq')}
            />

n           {/* Location (checklists and Composite IDs) — if you've built this section elsewhere, keep it as is */}
            {/* Error / Loading */}
            {error && <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 14 }}>{error}</div>}

            <div style={{ marginTop: 16 }}>
                <ReportCharts
                    // comment: datasets — currently empty, later fill by mapping API results
                    tempRangeData={chartData.tempRangeData}
                    phRangeData={chartData.phRangeData}
                    ecTdsRangeData={chartData.ecTdsRangeData}
                    doRangeData={chartData.doRangeData}
                    rangeData={chartData.rangeData}
                    xDomain={xDomain}
                    selectedDevice={selectedDeviceLabel}
                    selectedSensors={{
                        water: Array.from(selSensors.water),
                        light: Array.from(selSensors.light),
                        blue: Array.from(selSensors.blue),
                        red: Array.from(selSensors.red),
                        airq: Array.from(selSensors.airq),
                    }}
                />
            </div>
        </div>
    );
}
