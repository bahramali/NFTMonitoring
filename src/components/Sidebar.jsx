import React, {useState} from "react";
import {NavLink} from "react-router-dom";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const toggle = () => setCollapsed(c => !c);
    const linkClass = ({isActive}) =>
        `${styles.menuItem} ${isActive ? styles.active : ""}`;

    return (
        <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
            {/* Header */}
            <div className={styles.header}>
                <button className={`${styles.chevron} ${collapsed ? styles.rotated : ""}`} onClick={toggle}>
                    ▸
                </button>
                {!collapsed && <div className={styles.company}>Company</div>}
            </div>

            {/* Main Menu */}
            <nav className={styles.menu}>
                <NavLink to="/" className={linkClass}>
                    <span className={styles.icon}>🗂️</span>
                    {!collapsed && <span className={styles.text}>Systems</span>}
                </NavLink>
                <NavLink to="/settings" className={linkClass}>
                    <span className={styles.icon}>⚙️</span>
                    {!collapsed && <span className={styles.text}>Settings</span>}
                </NavLink>
                <NavLink to="/user" className={linkClass}>
                    <span className={styles.icon}>👤</span>
                    {!collapsed && <span className={styles.text}>User Info</span>}
                </NavLink>
                <NavLink to="/docs" className={linkClass}>
                    <span className={styles.icon}>📚</span>
                    {!collapsed && <span className={styles.text}>Documentation</span>}
                </NavLink>
            </nav>

            <div className={styles.divider}/>

            {/* System Filter */}
            <div className={styles.filterBlock}>
                {!collapsed && <div className={styles.filterTitle}>SYSTEM FILTER</div>}

                <NavLink to="/filters/device" className={linkClass}>
                    <span className={styles.icon}>▶</span>
                    {!collapsed && <span className={styles.text}>Device</span>}
                </NavLink>
                <NavLink to="/filters/layer" className={linkClass}>
                    <span className={styles.icon}>▶</span>
                    {!collapsed && <span className={styles.text}>Layer</span>}
                </NavLink>
                <NavLink to="/filters/system" className={linkClass}>
                    <span className={styles.icon}>▶</span>
                    {!collapsed && <span className={styles.text}>System</span>}
                </NavLink>
            </div>
        </aside>
    );
}
