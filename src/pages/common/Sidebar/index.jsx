import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

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
                <NavLink to="/overview" className={linkClass}>
                    <span className={styles.icon}>🏠</span>
                    {!collapsed && <span className={styles.text}>Overview</span>}
                </NavLink>
                <NavLink to="/live" className={linkClass}>
                    <span className={styles.icon}>📡</span>
                    {!collapsed && <span className={styles.text}>Live</span>}
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

        </aside>
    );
}
