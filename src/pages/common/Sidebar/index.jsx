import React, { useState, useEffect, useCallback, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { getMonitoringPages } from "../../../api/monitoringPages.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { PERMISSIONS, hasPerm, hasStoreAdminAccess } from "../../../utils/permissions.js";
import styles from "./Sidebar.module.css";

const DEFAULT_VIEWPORT_WIDTH = 1024;
const BREAKPOINTS = { mobile: 768, collapse: 1024 };

const getWindowWidth = () => (typeof window === "undefined" ? DEFAULT_VIEWPORT_WIDTH : window.innerWidth);

const MONITORING_BASE = "/monitoring";

const sortBySortOrder = (a, b) => {
    const orderA = Number.isFinite(a?.sortOrder) ? a.sortOrder : 0;
    const orderB = Number.isFinite(b?.sortOrder) ? b.sortOrder : 0;
    if (orderA !== orderB) return orderA - orderB;
    return String(a?.title ?? "").localeCompare(String(b?.title ?? ""));
};

const hasAccess = (item, role, roles = [], permissions = []) => {
    const availableRoles = roles.length > 0 ? roles : role ? [role] : [];
    const isSuperAdmin = availableRoles.includes("SUPER_ADMIN");

    if (item?.roles?.length > 0) {
        const matchesRole = availableRoles.some((userRole) => item.roles.includes(userRole));
        if (!matchesRole) return false;
    }

    if (!item?.permissions || item.permissions.length === 0) return true;
    if (isSuperAdmin) return true;

    const me = { permissions };
    return item.permissions.every((permission) => hasPerm(me, permission));
};

const NAV_SECTIONS = [
    {
        id: "monitoring",
        label: "Monitoring",
        items: [
            { to: `${MONITORING_BASE}/overview`, icon: "🏠", label: "Device Monitor", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/control-panel`, icon: "💡", label: "Control Panel", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/shelly-control`, icon: "🔌", label: "Shelly Control", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/live`, icon: "📡", label: "NFT Channels", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/germination`, icon: "🌱", label: "Germination", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/hall`, icon: "🏭", label: "Hall", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/cameras`, icon: "📷", label: "Cameras", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/reports`, icon: "📈", label: "Reports", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/note`, icon: "📝", label: "Note", permissions: [PERMISSIONS.MONITORING_VIEW] },
            { to: `${MONITORING_BASE}/sensor-config`, icon: "⚙️", label: "Sensor Config", permissions: [PERMISSIONS.MONITORING_VIEW] },
        ],
    },
    {
        id: "store",
        label: "Store",
        items: [
            { to: "/store", icon: "🛍️", label: "Products" },
            { icon: "📦", label: "Orders", disabled: true },
            { to: "/store/admin/customers", icon: "👥", label: "Customers", permissions: [PERMISSIONS.CUSTOMERS_VIEW] },
            { to: "/store/admin/products", icon: "🛍️", label: "Manage Products", permissions: [PERMISSIONS.PRODUCTS_MANAGE] },
        ],
    },
    {
        id: "admin",
        label: "Admin",
        items: [
            { to: "/admin/overview", icon: "📊", label: "Admin Overview", permissions: [PERMISSIONS.ADMIN_OVERVIEW_VIEW] },
            { to: "/admin/rack-pages", icon: "🧱", label: "Rack Pages", permissions: [PERMISSIONS.ADMIN_OVERVIEW_VIEW] },
            { to: "/admin/team", icon: "🧭", label: "Admin Management", permissions: [PERMISSIONS.ADMIN_PERMISSIONS_MANAGE] },
            { to: "/admin/tools", icon: "🛡️", label: "Super Admin Tools", roles: ["SUPER_ADMIN"] },
            { to: "/admin/directory", icon: "🗂️", label: "Admin Directory", roles: ["SUPER_ADMIN"] },
        ],
    },
];

export default function Sidebar() {
    const { role, roles, permissions } = useAuth();
    const [isMobile, setIsMobile] = useState(() => getWindowWidth() < BREAKPOINTS.mobile);
    const [collapsed, setCollapsed] = useState(() => {
        const width = getWindowWidth();
        if (width < BREAKPOINTS.mobile) return true;
        return width < BREAKPOINTS.collapse;
    });
    const [rackPagesState, setRackPagesState] = useState({
        status: "loading",
        pages: [],
    });
    const handleResize = useCallback(() => {
        const width = getWindowWidth();
        setIsMobile(width < BREAKPOINTS.mobile);

        if (width < BREAKPOINTS.mobile) {
            setCollapsed(true);
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

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const loadRackPages = async () => {
            setRackPagesState({ status: "loading", pages: [] });
            try {
                const payload = await getMonitoringPages({ signal: controller.signal });
                const pages = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.pages)
                        ? payload.pages
                        : [];
                const sortedPages = [...pages].sort(sortBySortOrder);
                if (isMounted) {
                    setRackPagesState({ status: "success", pages: sortedPages });
                }
            } catch (error) {
                if (!isMounted || error?.name === "AbortError") return;
                setRackPagesState({ status: "error", pages: [] });
            }
        };

        loadRackPages();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, []);

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

    const storeTarget = hasStoreAdminAccess(permissions)
        ? "/store/admin/products"
        : "/store";

    const rackPagesItems = useMemo(() => {
        if (rackPagesState.status === "loading") {
            return Array.from({ length: 3 }, (_, index) => ({
                label: `Loading rack pages ${index + 1}`,
                icon: "🧱",
                disabled: true,
                placeholder: true,
            }));
        }

        if (rackPagesState.status === "error") {
            return [
                {
                    icon: "⚠️",
                    label: "Failed to load rack pages",
                    disabled: true,
                },
            ];
        }

        if (rackPagesState.pages.length === 0) {
            return [
                {
                    icon: "🧱",
                    label: "No rack pages configured",
                    disabled: true,
                },
            ];
        }

        return rackPagesState.pages
            .filter((page) => page?.slug && page?.title)
            .map((page) => ({
                to: `${MONITORING_BASE}/pages/${page.slug}`,
                icon: "🧱",
                label: page.title,
                permissions: [PERMISSIONS.MONITORING_VIEW],
            }));
    }, [rackPagesState.pages, rackPagesState.status]);

    const sections = useMemo(() => {
        const mappedSections = NAV_SECTIONS.map((section) => {
            if (section.id === "store") {
                return {
                    ...section,
                    items: section.items.map((item) =>
                        item.label === "Products" ? { ...item, to: storeTarget } : item,
                    ),
                };
            }
            return section;
        });
        const rackPagesSection = {
            id: "rack-pages",
            label: "Rack Pages",
            items: rackPagesItems,
        };
        if (mappedSections.length === 0) {
            return [rackPagesSection];
        }
        return [mappedSections[0], rackPagesSection, ...mappedSections.slice(1)];
    }, [rackPagesItems, storeTarget]);

    const filteredSections = useMemo(() => {
        return sections
            .map((section) => {
                if (section.id === "admin") {
                    const visibleItems = section.items.filter((item) => hasAccess(item, role, roles, permissions));
                    return { ...section, items: visibleItems };
                }

                const visibleItems = section.items.map((item) => {
                    if (item.disabled || !item.to) {
                        return item;
                    }

                    if (hasAccess(item, role, roles, permissions)) {
                        return item;
                    }

                    return { ...item, disabled: true, disabledTitle: "Requires permission" };
                });

                return { ...section, items: visibleItems };
            })
            .filter((section) => section.items.length > 0);
    }, [permissions, role, roles, sections]);

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
                            {section.items.map(({ to, icon, label, disabled, placeholder, disabledTitle }) => {
                                if (disabled || !to) {
                                    return (
                                        <div
                                            key={`${section.id}-${label}`}
                                            className={`${styles.menuItem} ${styles.disabledItem} ${
                                                placeholder ? styles.skeletonItem : ""
                                            }`}
                                            title={disabledTitle}
                                        >
                                            <span className={placeholder ? styles.skeletonIcon : styles.icon}>{icon}</span>
                                            {!collapsed && (
                                                <span className={placeholder ? styles.skeletonText : styles.text}>
                                                    {label}
                                                </span>
                                            )}
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
