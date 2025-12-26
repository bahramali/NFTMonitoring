import React, { useState, useEffect, useCallback, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { hasStoreAdminAccess, STORE_PERMISSION_KEY } from "../../../utils/permissions.js";
import styles from "./Sidebar.module.css";

const DEFAULT_VIEWPORT_WIDTH = 1024;
const BREAKPOINTS = { mobile: 768, collapse: 1024 };

const getWindowWidth = () => (typeof window === "undefined" ? DEFAULT_VIEWPORT_WIDTH : window.innerWidth);

const MONITORING_BASE = "/monitoring";

const hasAccess = (item, role, permissions = []) => {
    if (!item?.roles || item.roles.length === 0) return true;
    if (!role || !item.roles.includes(role)) return false;

    if (item.permissions && item.permissions.length > 0 && role === "ADMIN") {
        if (item.permissions.includes(STORE_PERMISSION_KEY)) {
            return hasStoreAdminAccess(role, permissions);
        }
        return item.permissions.every((permission) => permissions?.includes(permission));
    }

    return true;
};

const NAV_SECTIONS = [
    {
        id: "monitoring",
        label: "Monitoring",
        items: [
            { to: `${MONITORING_BASE}/overview`, icon: "🏠", label: "Overview", roles: ["SUPER_ADMIN", "ADMIN", "WORKER"], permissions: ["ADMIN_DASHBOARD"] },
            { to: `${MONITORING_BASE}/control-panel`, icon: "💡", label: "Control Panel", roles: ["SUPER_ADMIN", "ADMIN", "WORKER"], permissions: ["ADMIN_DASHBOARD"] },
            { to: `${MONITORING_BASE}/shelly-control`, icon: "🔌", label: "Shelly Control", roles: ["SUPER_ADMIN", "ADMIN", "WORKER"], permissions: ["ADMIN_DASHBOARD"] },
            { to: `${MONITORING_BASE}/live`, icon: "📡", label: "NFT Channels", roles: ["SUPER_ADMIN", "ADMIN", "WORKER"], permissions: ["ADMIN_DASHBOARD"] },
            { to: `${MONITORING_BASE}/germination`, icon: "🌱", label: "Germination", roles: ["SUPER_ADMIN", "ADMIN", "WORKER"], permissions: ["ADMIN_DASHBOARD"] },
            { to: `${MONITORING_BASE}/cameras`, icon: "📷", label: "Cameras", roles: ["SUPER_ADMIN", "ADMIN", "WORKER"], permissions: ["ADMIN_DASHBOARD"] },
            { to: `${MONITORING_BASE}/reports`, icon: "📈", label: "Reports", roles: ["SUPER_ADMIN", "ADMIN"], permissions: ["ADMIN_REPORTS"] },
            { to: `${MONITORING_BASE}/note`, icon: "📝", label: "Note", roles: ["SUPER_ADMIN", "ADMIN", "WORKER"], permissions: ["ADMIN_DASHBOARD"] },
            { to: `${MONITORING_BASE}/sensor-config`, icon: "⚙️", label: "Sensor Config", roles: ["SUPER_ADMIN", "ADMIN", "WORKER"], permissions: ["ADMIN_DASHBOARD"] },
        ],
    },
    {
        id: "store",
        label: "Store",
        items: [
            { to: "/store", icon: "🛍️", label: "Products" },
            { icon: "📦", label: "Orders", disabled: true },
            { icon: "👥", label: "Customers", disabled: true },
        ],
    },
    {
        id: "admin",
        label: "Admin",
        items: [
            { to: "/admin/overview", icon: "📊", label: "Admin Overview", roles: ["SUPER_ADMIN", "ADMIN"], permissions: ["ADMIN_DASHBOARD"] },
            { to: "/admin/team", icon: "🧭", label: "Admin Management", roles: ["SUPER_ADMIN", "ADMIN"], permissions: ["ADMIN_TEAM"] },
            { to: "/admin/tools", icon: "🛡️", label: "Super Admin Tools", roles: ["SUPER_ADMIN"] },
            { to: "/admin/directory", icon: "🗂️", label: "Admin Directory", roles: ["SUPER_ADMIN"] },
        ],
    },
];

export default function Sidebar() {
    const { role, permissions } = useAuth();
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

    const storeTarget = hasStoreAdminAccess(role, permissions) ? "/store/admin/products" : "/store";

    const sections = useMemo(
        () =>
            NAV_SECTIONS.map((section) => {
                if (section.id === "store") {
                    return {
                        ...section,
                        items: section.items.map((item) =>
                            item.label === "Products" ? { ...item, to: storeTarget } : item,
                        ),
                    };
                }
                return section;
            }),
        [storeTarget],
    );

    const filteredSections = useMemo(() => {
        return sections
            .map((section) => {
                const visibleItems = section.items.filter((item) => {
                    if (item.disabled) return true;
                    return hasAccess(item, role, permissions);
                });
                return { ...section, items: visibleItems };
            })
            .filter((section) => section.items.length > 0);
    }, [permissions, role, sections]);

    return (
        <aside className={sidebarClassName}>
            <div className={styles.header}>
                {(!collapsed || isMobile) && <div className={styles.brand}>HydroLeaf</div>}
                <button
                    className={`${styles.toggle} ${collapsed ? styles.rotated : ""}`}
                    onClick={handleToggleCollapsed}
                    aria-label="Toggle sidebar"
                />
            </div>

            <nav className={styles.menu}>
                {filteredSections.map((section) => (
                    <div key={section.id} className={styles.section}>
                        {!collapsed && <div className={styles.sectionLabel}>{section.label}</div>}
                        <div className={styles.sectionItems}>
                            {section.items.map(({ to, icon, label, disabled }) => {
                                if (disabled || !to) {
                                    return (
                                        <div key={`${section.id}-${label}`} className={`${styles.menuItem} ${styles.disabledItem}`}>
                                            <span className={styles.icon}>{icon}</span>
                                            {!collapsed && <span className={styles.text}>{label}</span>}
                                        </div>
                                    );
                                }
                                return (
                                    <NavLink key={to} to={to} className={linkClass}>
                                        <span className={styles.icon}>{icon}</span>
                                        {!collapsed && <span className={styles.text}>{label}</span>}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
