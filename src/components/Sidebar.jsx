import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const toggle = () => setCollapsed((c) => !c);
    const linkClass = ({ isActive }) =>
        `${styles.menuItem} ${isActive ? styles.active : ''}`;

    return (
        <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
            <div className={styles.toggleButton} onClick={toggle}>
                ☰
            </div>
            <nav className={styles.menu}>
                <NavLink to="/" className={linkClass}>
                    <span className={styles.icon}>🏠</span>
                    {!collapsed && <span className={styles.text}>Dashboard</span>}
                </NavLink>
                <NavLink to="/reports" className={linkClass}>
                    <span className={styles.icon}>📊</span>
                    {!collapsed && <span className={styles.text}>Reports</span>}
                </NavLink>
                <NavLink to="/settings" className={linkClass}>
                    <span className={styles.icon}>⚙️</span>
                    {!collapsed && <span className={styles.text}>Settings</span>}
                </NavLink>
                <NavLink to="/user" className={linkClass}>
                    <span className={styles.icon}>👤</span>
                    {!collapsed && <span className={styles.text}>User</span>}
                </NavLink>
                <NavLink to="/docs" className={linkClass}>
                    <span className={styles.icon}>📄</span>
                    {!collapsed && <span className={styles.text}>Docs</span>}
                </NavLink>
                <NavLink to="/filters/device" className={linkClass}>
                    <span className={styles.icon}>🖥️</span>
                    {!collapsed && <span className={styles.text}>Device</span>}
                </NavLink>
                <NavLink to="/filters/layer" className={linkClass}>
                    <span className={styles.icon}>📚</span>
                    {!collapsed && <span className={styles.text}>Layer</span>}
                </NavLink>
                <NavLink to="/filters/system" className={linkClass}>
                    <span className={styles.icon}>🛠️</span>
                    {!collapsed && <span className={styles.text}>System</span>}
                </NavLink>
            </nav>
        </div>
    );
}
