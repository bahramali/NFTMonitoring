import React, {useState} from "react";
import {NavLink} from "react-router-dom";
import styles from "./Sidebar.module.css";
import {useFilters, ALL} from "../context/FiltersContext";

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [open, setOpen] = useState({device: false, layer: false, system: false});
    const {device, layer, system, setDevice, setLayer, setSystem, lists} = useFilters();

    const linkClass = ({isActive}) =>
        `${styles.menuItem} ${isActive ? styles.active : ""}`;

    const caret = (isOpen) => (
        <span className={`${styles.caret} ${isOpen ? styles.up : ""}`}/>
    );

    const Row = ({k, title, list, value, onChange}) => (
        <div className={styles.filterGroup}>
            <button
                type="button"
                className={styles.filterRow}
                onClick={() => setOpen(o => ({...o, [k]: !o[k]}))}
            >
                {!collapsed && <span className={styles.filterLabel}>{title}</span>}
                {caret(open[k])}
            </button>

            {open[k] && !collapsed && (
                <div className={styles.dropdown}>
                    <button
                        className={`${styles.option} ${value === ALL ? styles.selected : ""}`}
                        onClick={() => onChange(ALL)}
                    >All
                    </button>

                    {list.map(item => (
                        <button
                            key={item}
                            className={`${styles.option} ${value === item ? styles.selected : ""}`}
                            onClick={() => onChange(item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
            {/* Header */}
            <div className={styles.header}>
                {!collapsed && <div className={styles.brand}>HydroLeaf</div>}
                <button
                    className={`${styles.toggle} ${collapsed ? styles.rotated : ""}`}
                    onClick={() => setCollapsed(c => !c)}
                    aria-label="Toggle sidebar"
                />
            </div>

            {/* Main menu */}
            <nav className={styles.menu}>
                <NavLink to="/" className={linkClass}>
                    <span className={styles.icon}>🏠</span>
                    {!collapsed && <span className={styles.text}>Dashboard</span>}
                </NavLink>
                <NavLink to="/reports" className={linkClass}>
                    <span className={styles.icon}>📈</span>
                    {!collapsed && <span className={styles.text}>Reports</span>}
                </NavLink>
                <NavLink to="/settings" className={linkClass}>
                    <span className={styles.icon}>⚙️</span>
                    {!collapsed && <span className={styles.text}>Settings</span>}
                </NavLink>
                <NavLink to="/docs" className={linkClass}>
                    <span className={styles.icon}>📚</span>
                    {!collapsed && <span className={styles.text}>Documentation</span>}
                </NavLink>
            </nav>

            <div className={styles.divider}/>

            {/* Application filters */}
            <section className={styles.filters}>
                {!collapsed && <div className={styles.filtersTitle}>Application filters</div>}

                <Row k="device" title={`Device${device !== ALL ? `: ${device}` : ""}`}
                     list={lists.devices} value={device} onChange={setDevice}/>
                <Row k="layer" title={`Layer${layer !== ALL ? `: ${layer}` : ""}`}
                     list={lists.layers} value={layer} onChange={setLayer}/>
                <Row k="system" title={`System${system !== ALL ? `: ${system}` : ""}`}
                     list={lists.systems} value={system} onChange={setSystem}/>
            </section>
        </aside>
    );
}
