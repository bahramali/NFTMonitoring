import React, {useState} from "react";
import {NavLink} from "react-router-dom";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const linkClass = ({isActive}) =>
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

      {/* Filters */}
      <section className={styles.filters}>
        {!collapsed && <div className={styles.filtersTitle}>Application filters</div>}

        <button className={styles.filterRow} type="button">
          <span className={styles.filterText}>{!collapsed && "Device"}</span>
          <span className={styles.caret} />
        </button>

        <button className={styles.filterRow} type="button">
          <span className={styles.filterText}>{!collapsed && "Layer"}</span>
          <span className={styles.caret} />
        </button>

        <button className={styles.filterRow} type="button">
          <span className={styles.filterText}>{!collapsed && "System"}</span>
          <span className={styles.caret} />
        </button>
      </section>
        </aside>
    );
}
