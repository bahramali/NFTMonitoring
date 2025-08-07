import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

function Sidebar() {
    const [isOpen, setIsOpen] = useState(true);

    const toggleSidebar = () => setIsOpen((prev) => !prev);

    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}>
            <button className={styles.toggleButton} onClick={toggleSidebar} aria-label="Toggle sidebar">
                {isOpen ? '\u00AB' : '\u00BB'}
            </button>
            <nav className={styles.nav}>
                <NavLink to="/" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}> 
                    <span className={styles.linkText}>Home</span>
                </NavLink>
                <NavLink to="/reports" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                    <span className={styles.linkText}>Reports</span>
                </NavLink>
                <NavLink to="/settings" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                    <span className={styles.linkText}>Settings</span>
                </NavLink>
                <NavLink to="/user" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                    <span className={styles.linkText}>User</span>
                </NavLink>
                <NavLink to="/docs" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                    <span className={styles.linkText}>Docs</span>
                </NavLink>
                <NavLink to="/filters/device" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                    <span className={styles.linkText}>Device Filters</span>
                </NavLink>
                <NavLink to="/filters/layer" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                    <span className={styles.linkText}>Layer Filters</span>
                </NavLink>
                <NavLink to="/filters/system" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                    <span className={styles.linkText}>System Filters</span>
                </NavLink>
            </nav>
        </div>
    );
}

export default Sidebar;

