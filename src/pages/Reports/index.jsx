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

// ---------- meta loader (from cache or endpoint) ----------
function useDevicesMeta() {
    const [meta, setMeta] = useState({ devices: [] });

    useEffect(() => {
        // Try cache first
        const cached = localStorage.getItem("reportsMeta:v1");
        if (cached) {
            try {
                setMeta(JSON.parse(cached));
            } catch { /* empty */ }
        }
        // Optional: fetch fresh
        // fetch("/api/meta/devices")
        //   .then((r) => r.json())
        //   .then((data) => {
        //     localStorage.setItem("reportsMeta:v1", JSON.stringify(data));
        //     setMeta(data);
        //   })
        //   .catch(() => {});
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
    const [selSystems, setSelSystems] = useState(new Set());
    const [selLayers, setSelLayers] = useState(new Set());
    const [selDevices, setSelDevices] = useState(new Set()); // deviceId level
    const [selCIDs, setSelCIDs] = useState(new Set()); // compositeId explicit selection
    const [cidQuery, setCidQuery] = useState("");

    // ---------- derived lists ----------
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

    // ---------- toggle helpers ----------
    const toggleInSet = (value, set, setter) => {
        const next = new Set(set);
        next.has(value) ? next.delete(value) : next.add(value);
        setter(next);
    };
    const setAll = (list, setter) => setter(new Set(list));
    const setNone = (setter) => setter(new Set());

    // ---------- explicit CID toggle (back-propagate) ----------
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

    // ---------- selected CIDs to use ----------
    const selectedCIDs = useMemo(() => {
        const arr = Array.from(selCIDs);
        return arr.length ? arr : Array.from(new Set(filteredDeviceRows.map(toCID)));
    }, [selCIDs, filteredDeviceRows]);

    // ---------- sensors union ----------
    const allowedSensors = useMemo(() => {
        const rows = selectedCIDs
            .map((x) => deviceRows.find((d) => toCID(d) === x))
            .filter(Boolean);
        return new Set(rows.flatMap((d) => d.sensors || []));
    }, [selectedCIDs, deviceRows]);

    // ---------- fetch (one request per compositeId) ----------
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const abortRef = useRef(null);

    const fetchReportData = async () => {
        try {
            setError("");
            setLoading(true);
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            const signal = abortRef.current.signal;

            if (!selectedCIDs.length) {
                setLoading(false);
                return;
            }

            const baseParams = {
                from: toISOSeconds(fromDate),
                to: toISOSeconds(toDate),
                bucket,
            };

            // comment: one fetch per compositeId
            const requests = selectedCIDs.map(async (cid) => {
                const params = new URLSearchParams(baseParams);
                params.set("compositeId", cid);
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
            // TODO: pass results to charts (merge or render per-series)
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
            autoRefreshValue === "30s"
                ? 30_000
                : autoRefreshValue === "1m"
                    ? 60_000
                    : 5 * 60_000;
        const t = setInterval(fetchReportData, ms);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefreshValue, fromDate, toDate, bucket, selectedCIDs.join(",")]);

    // ---------- compare list ----------
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
                to: toISOSeconds(toDate),
                system: "-",
                layer: "-",
                device: "-",
                sensors: Array.from(allowedSensors),
            },
        ]);
    };
    const onRemoveCompare = (id) =>
        setCompareItems((p) => p.filter((x) => x.id !== id));
    const onClearCompare = () => setCompareItems([]);

    // ---------- actions ----------
    const onApply = () => fetchReportData();
    const onReset = () => {
        setSelSystems(new Set());
        setSelLayers(new Set());
        setSelDevices(new Set());
        setSelCIDs(new Set());
        setCidQuery("");
    };

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
                // location dropdown props (unused when using checklists below)
                systems={systems}
                layers={layers}
                devices={deviceIds}
                selectedSystem={null}
                onSystemChange={() => {}}
                selectedLayer={null}
                onLayerChange={() => {}}
                selectedDevice={null}
                onDeviceChange={() => {}}
                // actions
                onReset={onReset}
                onAddCompare={onAddCompare}
                onExportCsv={() => {}}
                // range
                rangeLabel={`From: ${new Date(fromDate).toLocaleString()} until: ${new Date(
                    toDate
                ).toLocaleString()}`}
                // compare
                compareItems={compareItems}
                onClearCompare={onClearCompare}
                onRemoveCompare={onRemoveCompare}
            />

            {/* Location cards (cascading selection + composite IDs) */}
            <div style={{ marginTop: 12 }} />

            {/* Error / Loading */}
            {error && (
                <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 14 }}>
                    {error}
                </div>
            )}

            {/* Charts */}
            <div style={{ marginTop: 16 }}>
                <ReportCharts loading={loading} />
            </div>
        </div>
    );
}
