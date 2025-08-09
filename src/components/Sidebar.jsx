import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useFilters, ALL } from "../context/FiltersContext";

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const { device, layer, system, topic, setDevice, setLayer, setSystem, setTopic, lists } = useFilters();

    const linkClass = ({ isActive }) =>
        `${styles.menuItem} ${isActive ? styles.active : ""}`;

    const CheckboxGroup = ({ title, list, value, onChange }) => (
        <div className={styles.filterGroup}>
            {!collapsed && <div className={styles.filterLabel}>{title}</div>}

            {!collapsed && (
                <div className={styles.dropdown}>
                    <label className={`${styles.option} ${value === ALL ? styles.selected : ""}`}>
                        <input
                            type="checkbox"
                            checked={value === ALL}
                            onChange={() => onChange(ALL)}
                        />
                        All
                    </label>

                    {list.map((item) => (
                        <label
                            key={item}
                            className={`${styles.option} ${value === item ? styles.selected : ""}`}
                        >
                            <input
                                type="checkbox"
                                checked={value === item}
                                onChange={() => onChange(value === item ? ALL : item)}
                            />
                            {item}
                        </label>
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

                <CheckboxGroup title="Topic" list={lists.topics} value={topic} onChange={setTopic} />
                <CheckboxGroup title="Device" list={lists.devices} value={device} onChange={setDevice} />
                <CheckboxGroup title="Layer" list={lists.layers} value={layer} onChange={setLayer} />
                <CheckboxGroup title="System" list={lists.systems} value={system} onChange={setSystem} />
            </section>
        </aside>
    );
}
