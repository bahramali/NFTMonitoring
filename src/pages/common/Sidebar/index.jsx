import React, { useState, useEffect, useMemo, useCallback } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import ReportFiltersCompare from "../../Reports/components/ReportFiltersCompare";
import { useReportsFilters } from "../../../context/ReportsFiltersContext.jsx";

const DEFAULT_VIEWPORT_WIDTH = 1024;
const BREAKPOINTS = { mobile: 768, collapse: 1024 };

const getWindowWidth = () => (typeof window === "undefined" ? DEFAULT_VIEWPORT_WIDTH : window.innerWidth);

const NAV_ITEMS = [
    { to: "/overview", icon: "🏠", label: "Overview" },
    { to: "/control-panel", icon: "💡", label: "Control Panel" },
    { to: "/live", icon: "📡", label: "NFT Channels" },
    { to: "/germination", icon: "🌱", label: "Germination" },
    { to: "/cameras", icon: "📷", label: "Cameras" },
    { to: "/reports", icon: "📈", label: "Reports" },
    { to: "/note", icon: "📝", label: "Note" },
    { to: "/sensor-config", icon: "⚙️", label: "Sensor Config" },
];

const NOOP = () => {};

const formatTopicLabel = (id) =>
    String(id || "")
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/^\s+|\s+$/g, "")
        .replace(/^./, (ch) => ch.toUpperCase());

export default function Sidebar() {
    const [isMobile, setIsMobile] = useState(() => getWindowWidth() < BREAKPOINTS.mobile);
    const [collapsed, setCollapsed] = useState(() => {
        const width = getWindowWidth();
        if (width < BREAKPOINTS.mobile) return false;
        return width < BREAKPOINTS.collapse;
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
        selectedTopics,
        toggleTopicSelection,
        setAllTopics,
        clearTopics,
        availableTopicSensors,
        availableTopicDevices,
        toggleSensor,
        setAllSensors,
        clearSensors,
        selectedCIDs,
        selectedCompositeIds,
        handleCompositeSelectionChange,
        triggerApply,
    } = useReportsFilters();

    const handleResize = useCallback(() => {
        const width = getWindowWidth();
        setIsMobile(width < BREAKPOINTS.mobile);

        if (width < BREAKPOINTS.mobile) {
            setCollapsed(false);
        } else if (width < BREAKPOINTS.collapse) {
            setCollapsed(true);
        } else {
            setCollapsed(false);
        }
    }, []);

    useEffect(() => {
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [handleResize]);

    const linkClass = useCallback(
        ({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ""}`,
        [],
    );

    const topicList = useMemo(() => {
        const entries = Object.entries(availableTopicSensors || {});
        return entries.map(([id, sensors]) => ({ id, label: formatTopicLabel(id), sensors }));
    }, [availableTopicSensors]);

    const topicDeviceOptions = useMemo(() => {
        const entries = Object.entries(availableTopicDevices || {});
        return entries.reduce((acc, [topic, devices]) => {
            acc[topic] = Array.isArray(devices) ? devices : [];
            return acc;
        }, {});
    }, [availableTopicDevices]);

    const selectedSensorsByTopic = useMemo(() => {
        const map = {};
        Object.entries(selSensors || {}).forEach(([topic, values]) => {
            map[topic] = Array.from(values || []);
        });
        return map;
    }, [selSensors]);

    const selectedTopicIds = useMemo(() => Array.from(selectedTopics || []), [selectedTopics]);

    const handleToggleCollapsed = useCallback(() => {
        setCollapsed((prev) => !prev);
    }, []);

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
        (topic, key) => toggleSensor(topic, key),
        [toggleSensor],
    );

    const handleAllTopicSensors = useCallback(
        (topic, keys) => setAllSensors(topic, keys),
        [setAllSensors],
    );

    const handleNoneTopicSensors = useCallback(
        (topic) => clearSensors(topic),
        [clearSensors],
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

    const sidebarClassName = useMemo(() => {
        return [
            styles.sidebar,
            collapsed ? styles.collapsed : "",
            isMobile ? styles.mobile : "",
            isMobile && collapsed ? styles.mobileCollapsed : "",
        ]
            .filter(Boolean)
            .join(" ");
    }, [collapsed, isMobile]);

    return (
        <aside className={sidebarClassName}>
            {/* Header */}
            <div className={styles.header}>
                {(!collapsed || isMobile) && <div className={styles.brand}>HydroLeaf</div>}
                <button
                    className={`${styles.toggle} ${collapsed ? styles.rotated : ""}`}
                    onClick={handleToggleCollapsed}
                    aria-label="Toggle sidebar"
                />
            </div>

            {/* Main menu */}
            <nav className={styles.menu}>
                {NAV_ITEMS.map(({ to, icon, label }) => (
                    <NavLink key={to} to={to} className={linkClass}>
                        <span className={styles.icon}>{icon}</span>
                        {!collapsed && <span className={styles.text}>{label}</span>}
                    </NavLink>
                ))}
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
                            onCompositeSelectionChange={handleCompositeSelectionChange}
                            onReset={onReset}
                            onAddCompare={onAddCompare}
                            onExportCsv={NOOP}
                            rangeLabel={rangeLabel}
                            compareItems={compareItems}
                            onClearCompare={onClearCompare}
                            onRemoveCompare={onRemoveCompare}
                            topics={topicList}
                            selectedTopics={selectedTopicIds}
                            onTopicToggle={toggleTopicSelection}
                            onAllTopics={setAllTopics}
                            onNoneTopics={clearTopics}
                            topicSensors={availableTopicSensors}
                            topicDevices={topicDeviceOptions}
                            selectedTopicSensors={selectedSensorsByTopic}
                            onToggleTopicSensor={handleTopicSensorToggle}
                            onAllTopicSensors={handleAllTopicSensors}
                            onNoneTopicSensors={handleNoneTopicSensors}
                            selectedCompositeIds={selectedCompositeIds}
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
