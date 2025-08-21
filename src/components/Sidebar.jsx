import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useFilters, ALL } from "../context/FiltersContext";

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
    const { layer, system, topic, setLayer, setSystem, setTopic, lists } = useFilters();

    useEffect(() => {
        const handleResize = () => {
            const shouldCollapse = window.innerWidth < 768;
            setCollapsed((prev) => (prev === shouldCollapse ? prev : shouldCollapse));
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const linkClass = ({ isActive }) =>
        `${styles.menuItem} ${isActive ? styles.active : ""}`;

    const CheckboxGroup = ({ title, list, values, onChange }) => (
        <div className={styles.filterGroup}>
            {!collapsed && <div className={styles.filterLabel}>{title}</div>}

            {!collapsed && (
                <div className={styles.dropdown}>
                    <label className={`${styles.option} ${values.length === 0 ? styles.selected : ""}`}>
                        <input
                            type="checkbox"
                            checked={values.length === 0}
                            onChange={() => onChange(ALL)}
                        />
                        All
                    </label>

                    {list.map((item) => (
                        <label
                            key={item}
                            className={`${styles.option} ${values.includes(item) ? styles.selected : ""}`}
                        >
                            <input
                                type="checkbox"
                                checked={values.includes(item)}
                                onChange={() => onChange(item)}
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
                <NavLink to="/live" className={linkClass}>
                    <span className={styles.icon}>📡</span>
                    {!collapsed && <span className={styles.text}>Live</span>}
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

                <CheckboxGroup title="Topic" list={lists.topics} values={topic} onChange={setTopic} />
                <CheckboxGroup title="Layer" list={lists.layers} values={layer} onChange={setLayer} />
                <CheckboxGroup title="System" list={lists.systems} values={system} onChange={setSystem} />
            </section>
        </aside>
    );
}
