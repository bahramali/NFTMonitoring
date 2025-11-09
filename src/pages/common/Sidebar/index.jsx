import React, { useState, useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import ReportFiltersCompare from "../../Reports/components/ReportFiltersCompare";
import { useReportsFilters } from "../../../context/ReportsFiltersContext.jsx";

const getWindowWidth = () => (typeof window === "undefined" ? 1024 : window.innerWidth);

export default function Sidebar() {
    const [isMobile, setIsMobile] = useState(() => getWindowWidth() < 768);
    const [collapsed, setCollapsed] = useState(() => {
        const width = getWindowWidth();
        if (width < 768) return false;
        return width < 1024;
    });
    const {
        isReportsRoute,
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
        toggleSensor,
        setAllSensors,
        clearSensors,
        selectedCIDs,
        handleCompositeSelectionChange,
        triggerApply,
    } = useReportsFilters();

    useEffect(() => {
        const handleResize = () => {
            const width = getWindowWidth();
            setIsMobile(width < 768);

            if (width < 768) {
                setCollapsed(false);
            } else if (width < 1024) {
                setCollapsed(true);
            } else {
                setCollapsed(false);
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const linkClass = ({ isActive }) =>
        `${styles.menuItem} ${isActive ? styles.active : ""}`;

    const sensorValues = useMemo(
        () => ({
            water: Array.from(selSensors.water),
            light: Array.from(selSensors.light),
            blue: Array.from(selSensors.blue),
            red: Array.from(selSensors.red),
            airq: Array.from(selSensors.airq),
        }),
        [selSensors],
    );

    const toLabels = (keys = []) =>
        keys.map((item) => (typeof item === "string" ? item : item?.label)).filter(Boolean);

    const rangeLabel = useMemo(() => {
        if (!fromDate || !toDate) return "";
        const from = new Date(fromDate);
        const to = new Date(toDate);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
        return `From: ${from.toLocaleString()} until: ${to.toLocaleString()}`;
    }, [fromDate, toDate]);

    const sidebarClassName = [
        styles.sidebar,
        collapsed ? styles.collapsed : "",
        isMobile ? styles.mobile : "",
        isMobile && collapsed ? styles.mobileCollapsed : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <aside className={sidebarClassName}>
            {/* Header */}
            <div className={styles.header}>
                {(!collapsed || isMobile) && <div className={styles.brand}>HydroLeaf</div>}
                <button
                    className={`${styles.toggle} ${collapsed ? styles.rotated : ""}`}
                    onClick={() => setCollapsed(c => !c)}
                    aria-label="Toggle sidebar"
                />
            </div>

            {/* Main menu */}
            <nav className={styles.menu}>
                <NavLink to="/overview" className={linkClass}>
                    <span className={styles.icon}>🏠</span>
                    {!collapsed && <span className={styles.text}>Overview</span>}
                </NavLink>
                <NavLink to="/control-panel" className={linkClass}>
                    <span className={styles.icon}>💡</span>
                    {!collapsed && <span className={styles.text}>Control Panel</span>}
                </NavLink>
                <NavLink to="/live" className={linkClass}>
                    <span className={styles.icon}>📡</span>
                    {!collapsed && <span className={styles.text}>NFT Channels</span>}
                </NavLink>
                <NavLink to="/germination" className={linkClass}>
                    <span className={styles.icon}>🌱</span>
                    {!collapsed && <span className={styles.text}>Germination</span>}
                </NavLink>
                <NavLink to="/cameras" className={linkClass}>
                    <span className={styles.icon}>📷</span>
                    {!collapsed && <span className={styles.text}>Cameras</span>}
                </NavLink>
                <NavLink to="/reports" className={linkClass}>
                    <span className={styles.icon}>📈</span>
                    {!collapsed && <span className={styles.text}>Reports</span>}
                </NavLink>
                <NavLink to="/note" className={linkClass}>
                    <span className={styles.icon}>📝</span>
                    {!collapsed && <span className={styles.text}>Note</span>}
                </NavLink>
                <NavLink to="/sensor-config" className={linkClass}>
                    <span className={styles.icon}>⚙️</span>
                    {!collapsed && <span className={styles.text}>Sensor Config</span>}
                </NavLink>
            </nav>

            {isReportsRoute && !collapsed && (
                <div className={styles.filtersWrapper}>
                    <div className={styles.divider} />
                    <div className={styles.reportFiltersWrapper}>
                        <ReportFiltersCompare
                            variant="sidebar"
                            catalog={deviceMeta}
                            fromDate={fromDate}
                            toDate={toDate}
                            onFromDateChange={(e) => setFromDate(e.target.value)}
                            onToDateChange={(e) => setToDate(e.target.value)}
                            onApply={triggerApply}
                            autoRefreshValue={autoRefreshValue}
                            onAutoRefreshValueChange={(e) => setAutoRefreshValue(e.target.value)}
                            systems={systems}
                            layers={layers}
                            devices={deviceIds}
                            onSystemChange={handleSystemChange}
                            onLayerChange={handleLayerChange}
                            onDeviceChange={handleDeviceChange}
                            onCompositeSelectionChange={handleCompositeSelectionChange}
                            onReset={onReset}
                            onAddCompare={onAddCompare}
                            onExportCsv={() => {}}
                            rangeLabel={rangeLabel}
                            compareItems={compareItems}
                            onClearCompare={onClearCompare}
                            onRemoveCompare={onRemoveCompare}
                            water={{ values: sensorValues.water }}
                            light={{ values: sensorValues.light }}
                            blue={{ values: sensorValues.blue }}
                            red={{ values: sensorValues.red }}
                            airq={{ values: sensorValues.airq }}
                            onToggleWater={(key) => toggleSensor("water", key)}
                            onToggleLight={(key) => toggleSensor("light", key)}
                            onToggleBlue={(key) => toggleSensor("blue", key)}
                            onToggleRed={(key) => toggleSensor("red", key)}
                            onToggleAirq={(key) => toggleSensor("airq", key)}
                            onAllWater={(keys) => setAllSensors("water", toLabels(keys))}
                            onNoneWater={() => clearSensors("water")}
                            onAllLight={(keys) => setAllSensors("light", toLabels(keys))}
                            onNoneLight={() => clearSensors("light")}
                            onAllBlue={(keys) => setAllSensors("blue", toLabels(keys))}
                            onNoneBlue={() => clearSensors("blue")}
                            onAllRed={(keys) => setAllSensors("red", toLabels(keys))}
                            onNoneRed={() => clearSensors("red")}
                            onAllAirq={(keys) => setAllSensors("airq", toLabels(keys))}
                            onNoneAirq={() => clearSensors("airq")}
                        />
                        {selectedCIDs.length <= 1 ? null : (
                            <div className={styles.selectionHint}>
                                {`${selectedCIDs.length} devices selected`}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </aside>
    );
}
