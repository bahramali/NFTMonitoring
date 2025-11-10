import React, { useState, useEffect, useCallback, useMemo } from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

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

export default function Sidebar() {
    const [isMobile, setIsMobile] = useState(() => getWindowWidth() < BREAKPOINTS.mobile);
    const [collapsed, setCollapsed] = useState(() => {
        const width = getWindowWidth();
        if (width < BREAKPOINTS.mobile) return false;
        return width < BREAKPOINTS.collapse;
    });
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

    const handleToggleCollapsed = useCallback(() => {
        setCollapsed((prev) => !prev);
    }, []);

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

        </aside>
    );
}
