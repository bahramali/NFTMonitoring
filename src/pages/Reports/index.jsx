// index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReportCharts from "./components/ReportCharts";
import ReportFiltersCompare from "./components/ReportFiltersCompare";

// ---------- utils ----------
const toCID = (d) => `${d.systemId}-${d.layerId}-${d.deviceId}`;
const toLocalInputValue = (date) => {
    // comment: yyyy-MM-ddTHH:mm for <input type="datetime-local">
    const pad = (n) => `${n}`.padStart(2, "0");
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
};
const toISOSeconds = (v) => (v ? new Date(v).toISOString() : "");

// ---------- meta loader (localStorage) ----------
function useDevicesMeta() {
    const [meta, setMeta] = useState({ devices: [] });

    useEffect(() => {
        const cached = localStorage.getItem("reportsMeta:v1") || localStorage.getItem("deviceCatalog");
        if (cached) {
            try { setMeta(JSON.parse(cached)); } catch {}
        }
        // comment: اگر API داری اینجا تازه‌سازی کن
        // fetch("/api/meta/devices").then(r=>r.json()).then(d=>{ localStorage.setItem("reportsMeta:v1", JSON.stringify(d)); setMeta(d); });
    }, []);

    return meta;
}

export default function Reports() {
    // ---------- meta ----------
    const { devices: deviceRows } = useDevicesMeta(); // [{systemId,layerId,deviceId,sensors:[]}, ...]

    // ---------- timing ----------
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() - 6);
        return toLocalInputValue(d);
    });
    const [toDate, setToDate] = useState(() => toLocalInputValue(new Date()));
    const [bucket, setBucket] = useState("5m");
    const [autoRefreshValue, setAutoRefreshValue] = useState("Off");

    // ---------- location selections ----------
    const [selSystems, setSelSystems]   = useState(new Set());
    const [selLayers, setSelLayers]     = useState(new Set());
    const [selDevices, setSelDevices]   = useState(new Set());
    const [selCIDs, setSelCIDs]         = useState(new Set());
    const [cidQuery, setCidQuery]       = useState("");

    // ---------- sensor selections (per group) ----------
    // comment: values are EXACT keys مثل: dissolvedEC, 405nm, humidity, light, ...
    const [selSensors, setSelSensors] = useState({
        water: new Set(),   // dissolvedTemp, dissolvedEC, dissolvedTDS, dissolvedOxygen, (ph اگر داری)
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

    // ---------- derived lists (cascading) ----------
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

    const cidsVisible = useMemo(() => {
        const list = filteredDeviceRows.map(toCID);
        return cidQuery
            ? list.filter((x) => x.toLowerCase().includes(cidQuery.toLowerCase()))
            : list;
    }, [filteredDeviceRows, cidQuery]);

    // ---------- sync: S/L/D -> CIDs ----------
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

    // ---------- explicit CID toggle ----------
    const toggleCID = (cid) => {
        const next = new Set(selCIDs);
        next.has(cid) ? next.delete(cid) : next.add(cid);
        setSelCIDs(next);

        if (next.size) {
            const rows = deviceRows.filter((d) => next.has(toCID(d)));
            setSelSystems(new Set(rows.map((d) => d.systemId)));
            setSelLayers(new Set(rows.map((d) => d.layerId)));
            setSelDevices(new Set(rows.map((d) => d.deviceId)));
        }
    };

    // ---------- selected CIDs used for requests ----------
    const selectedCIDs = useMemo(() => {
        const arr = Array.from(selCIDs);
        return arr.length ? arr : Array.from(new Set(filteredDeviceRows.map(toCID)));
    }, [selCIDs, filteredDeviceRows]);

    // ---------- REQUESTS (one per compositeId) ----------
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState("");
    const abortRef = useRef(null);

    // comment: datasets kept here (structure ساده — اگه API داره، نگه‌داری شکل واقعی رو جایگزین کن)
    const [chartData, setChartData] = useState({
        tempRangeData: [],   // for HistoricalTemperatureChart
        phRangeData:   [],   // for HistoricalPhChart (در صورت داشتن pH)
        ecTdsRangeData:[],   // for HistoricalEcTdsChart
        doRangeData:   [],   // for HistoricalDoChart
        rangeData:     [],   // برای MultiBand / ClearLux (در صورت نیاز)
    });

    const fetchReportData = async () => {
        try {
            setError("");
            setLoading(true);
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            const signal = abortRef.current.signal;

            if (!selectedCIDs.length) { setLoading(false); return; }

            // sensors union انتخاب‌شده — برای ارسال به API
            const sensorsSelected = [
                ...selSensors.water, ...selSensors.light,
                ...selSensors.blue,  ...selSensors.red,
                ...selSensors.airq,
            ];
            // اگر هیچ سنسوری انتخاب نشده بود، می‌تونی اینو خالی بذاری تا API پیش‌فرض برگردونه
            const sensorsParam = sensorsSelected.join(',');

            const baseParams = {
                from: toISOSeconds(fromDate),
                to:   toISOSeconds(toDate),
                bucket,
            };

            const requests = selectedCIDs.map(async (cid) => {
                const params = new URLSearchParams(baseParams);
                params.set("compositeId", cid);
                if (sensorsParam) params.set("sensors", sensorsParam); // comment: در صورت پشتیبانی بک‌اند

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
            // comment: اینجا دیتارو به شکل مورد نیاز چارت‌ها مپ کن.
            // فعلاً خالی نگه می‌داریم تا سکشن‌ها دیده بشن و بعداً مپ واقعی‌ت رو بذاری.
            setChartData((prev) => ({ ...prev }));
            console.log("history results", results);
        } catch (e) {
            if (e.name !== "AbortError") {
                console.error(e);
                setError(String(e.message || e));
            }
        } finally {
            setLoading(false);
        }
    };

    // ---------- auto refresh ----------
    useEffect(() => {
        if (autoRefreshValue === "Off") return;
        const ms =
            autoRefreshValue === "30s" ? 30_000 :
                autoRefreshValue === "1m"  ? 60_000 :
                    5 * 60_000;
        const t = setInterval(fetchReportData, ms);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefreshValue, fromDate, toDate, bucket, selectedCIDs.join(","), JSON.stringify([...selSensors.water, ...selSensors.light, ...selSensors.blue, ...selSensors.red, ...selSensors.airq])]);

    // ---------- compare (همون قبلی) ----------
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

    // ---------- actions ----------
    const onApply = () => fetchReportData();
    const onReset = () => {
        setSelSystems(new Set());
        setSelLayers(new Set());
        setSelDevices(new Set());
        setSelCIDs(new Set());
        setCidQuery("");
        setSelSensors({ water:new Set(), light:new Set(), blue:new Set(), red:new Set(), airq:new Set() });
    };

    // ---------- flags for charts (نمایش سکشن‌ها بر اساس انتخاب سنسور) ----------
    const showTempHum  = selSensors.airq.has('temperature') || selSensors.airq.has('humidity');
    const showSpectrum = selSensors.blue.size > 0 || selSensors.red.size > 0;
    const showClearLux = selSensors.light.size > 0; // VIS1/VIS2/NIR855/light
    const showPh       = selSensors.water.has('ph') || selSensors.water.has('pH'); // اگر pH داری
    const showEcTds    = selSensors.water.has('dissolvedEC') || selSensors.water.has('dissolvedTDS');
    const showDo       = selSensors.water.has('dissolvedOxygen');

    const xDomain = [new Date(fromDate).getTime(), new Date(toDate).getTime()];
    const selectedDeviceLabel = selectedCIDs.length === 1 ? selectedCIDs[0] : "";

    // ---------- render ----------
    return (
        <div style={{ padding: 16 }}>
            <ReportFiltersCompare
                // timing
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={(e) => setFromDate(e.target.value)}
                onToDateChange={(e) => setToDate(e.target.value)}
                onApply={onApply}
                bucket={bucket}
                onBucketChange={(e) => setBucket(e.target.value)}
                autoRefreshValue={autoRefreshValue}
                onAutoRefreshValueChange={(e) => setAutoRefreshValue(e.target.value)}

                // location lists
                systems={systems}
                layers={layers}
                devices={deviceIds}

                // actions
                onReset={onReset}
                onAddCompare={onAddCompare}
                onExportCsv={() => {}}
                rangeLabel={`From: ${new Date(fromDate).toLocaleString()} until: ${new Date(toDate).toLocaleString()}`}
                compareItems={compareItems}
                onClearCompare={onClearCompare}
                onRemoveCompare={onRemoveCompare}

                // sensors — فقط values و handlerها (خود کامپوننت optionها را از کاتالوگ می‌سازد)
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

            {/* Location (چک‌لیست‌ها و Composite IDs) — اگر این سکشن را جای دیگری ساخته‌ای، همونو نگه دار */}

            {/* Error / Loading */}
            {error && <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 14 }}>{error}</div>}

            {/* Charts */}
            <div style={{ marginTop: 16 }}>
                <ReportCharts
                    showTempHum={showTempHum}
                    showSpectrum={showSpectrum}
                    showClearLux={showClearLux}
                    showPh={showPh}
                    showEcTds={showEcTds}
                    showDo={showDo}
                    // comment: datasets — الان خالی، بعداً با map نتایج API پر کن
                    tempRangeData={chartData.tempRangeData}
                    phRangeData={chartData.phRangeData}
                    ecTdsRangeData={chartData.ecTdsRangeData}
                    doRangeData={chartData.doRangeData}
                    rangeData={chartData.rangeData}
                    xDomain={xDomain}
                    selectedDevice={selectedDeviceLabel}
                />
            </div>
        </div>
    );
}
