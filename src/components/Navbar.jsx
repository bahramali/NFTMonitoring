import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStorefront } from '../context/StorefrontContext.jsx';
import hydroleafLogo from '../assets/hydroleaf_logo.png';
import styles from './Navbar.module.css';
import { hasStoreAdminAccess, STORE_PERMISSION_KEY } from '../utils/permissions.js';
import { formatCurrency } from '../utils/currency.js';

const NAV_ITEMS = [
    { path: '/store', label: 'Store', requiresAuth: true },
    {
        path: '/my-page',
        label: 'My Page',
        requiresAuth: true,
        roles: ['CUSTOMER'],
    },
    {
        path: '/dashboard/overview',
        label: 'Monitoring',
        requiresAuth: true,
        roles: ['SUPER_ADMIN', 'ADMIN', 'WORKER'],
        permissions: ['ADMIN_DASHBOARD'],
    },
];

const ADMIN_MENU = [
    {
        path: '/admin',
        label: 'Admin Overview',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: ['ADMIN_DASHBOARD'],
    },
    {
        path: '/admin/team',
        label: 'Admin Management',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: ['ADMIN_TEAM'],
    },
    {
        path: '/monitoring/admin/products',
        label: 'Products',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: [STORE_PERMISSION_KEY],
    },
    { path: '/super-admin', label: 'Super Admin Tools', roles: ['SUPER_ADMIN'] },
    { path: '/super-admin/admins', label: 'Admin Directory', roles: ['SUPER_ADMIN'] },
];

const hasAccess = (item, role, permissions = []) => {
    if (!item?.roles || item.roles.length === 0) return true;
    if (!role || !item.roles.includes(role)) return false;

    if (item.permissions && item.permissions.length > 0 && role === 'ADMIN') {
        if (item.permissions.includes(STORE_PERMISSION_KEY)) {
            return hasStoreAdminAccess(role, permissions);
        }
        return item.permissions.every((permission) => permissions?.includes(permission));
    }

    return true;
};

export default function Navbar() {
    const { isAuthenticated, userId, role, permissions, logout } = useAuth();
    const { cart, openCart } = useStorefront();
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const adminMenuRef = useRef(null);
    const userMenuRef = useRef(null);
    const location = useLocation();
    const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
    const isStoreRoute = location.pathname === '/store' || location.pathname.startsWith('/store/');

    const roleLabel = role ? role.replace('_', ' ') : '';
    const userLabel = userId ? `User #${userId}` : 'Account';
    const userInitial = userLabel?.trim()?.charAt(0)?.toUpperCase() || 'U';

    const primaryLinks = useMemo(() => {
        return NAV_ITEMS.filter((item) => {
            if (item.requiresAuth && !isAuthenticated) return false;
            return hasAccess(item, role, permissions);
        });
    }, [isAuthenticated, permissions, role]);

    const itemCount = useMemo(
        () => cart?.items?.reduce((acc, item) => acc + (item.quantity ?? item.qty ?? 0), 0) || 0,
        [cart],
    );
    const totalLabel = useMemo(
        () => formatCurrency(cart?.totals?.total ?? cart?.totals?.subtotal ?? 0, cart?.totals?.currency || 'SEK'),
        [cart?.totals?.currency, cart?.totals?.subtotal, cart?.totals?.total],
    );

    const adminLinks = useMemo(() => {
        if (!isAuthenticated) return [];
        return ADMIN_MENU.filter((item) => hasAccess(item, role, permissions));
    }, [isAuthenticated, permissions, role]);

    useEffect(() => {
        setIsNavOpen(false);
        setIsAdminOpen(false);
        setIsUserMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
                setIsAdminOpen(false);
            }

            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsAdminOpen(false);
                setIsUserMenuOpen(false);
                setIsNavOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const navLinkClassName = ({ isActive }) =>
        [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ');

    const handleNavLinkClick = () => {
        setIsNavOpen(false);
        setIsAdminOpen(false);
        setIsUserMenuOpen(false);
    };

    const adminTriggerClassName = [
        styles.dropdownTrigger,
        isAdminOpen || isAdminRoute ? styles.dropdownTriggerActive : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <div className={styles.brandBlock}>
                    <Link to="/" className={styles.brand}>
                        <img src={hydroleafLogo} alt="HydroLeaf logo" className={styles.brandLogo} />
                        <div className={styles.brandCopy}>
                            <span className={styles.brandName}>HydroLeaf</span>
                            <span className={styles.brandSubtitle}>NFT Monitoring</span>
                        </div>
                    </Link>
                </div>

                <div className={styles.navSection}>
                    <button
                        type="button"
                        className={styles.menuToggle}
                        aria-label="Toggle navigation"
                        aria-expanded={isNavOpen}
                        onClick={() => setIsNavOpen((open) => !open)}
                    >
                        <span className={styles.menuIcon} aria-hidden="true" />
                        <span className={styles.menuLabel}>Menu</span>
                    </button>

                    <nav className={`${styles.nav} ${isNavOpen ? styles.navOpen : ''}`}>
                        <div className={styles.navList}>
                            {primaryLinks.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={navLinkClassName}
                                    onClick={handleNavLinkClick}
                                >
                                    {item.label}
                                </NavLink>
                            ))}

                            {adminLinks.length > 0 && (
                                <div className={styles.dropdown} ref={adminMenuRef}>
                                    <button
                                        type="button"
                                        className={adminTriggerClassName}
                                        aria-expanded={isAdminOpen}
                                        onClick={() => {
                                            setIsAdminOpen((open) => !open);
                                            setIsUserMenuOpen(false);
                                        }}
                                    >
                                        Admin
                                        <span className={styles.caret} aria-hidden="true" />
                                    </button>
                                    <div
                                        className={`${styles.dropdownMenu} ${
                                            isAdminOpen ? styles.dropdownMenuOpen : ''
                                        }`}
                                    >
                                        {adminLinks.map((item) => (
                                            <NavLink
                                                key={item.path}
                                                to={item.path}
                                                className={navLinkClassName}
                                                onClick={handleNavLinkClick}
                                            >
                                                {item.label}
                                            </NavLink>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </nav>
                </div>

                <div className={styles.authSection}>
                    {isStoreRoute && (
                        <button type="button" className={styles.storeCartButton} onClick={openCart}>
                            <span className={styles.storeCartLabel}>Cart</span>
                            <span className={styles.storeCartBadge}>{itemCount}</span>
                            <span className={styles.storeCartTotal}>{totalLabel}</span>
                        </button>
                    )}
                    {isAuthenticated ? (
                        <div className={styles.userArea} ref={userMenuRef}>
                            <button
                                type="button"
                                className={styles.userButton}
                                aria-expanded={isUserMenuOpen}
                                onClick={() => {
                                    setIsUserMenuOpen((open) => !open);
                                    setIsAdminOpen(false);
                                }}
                            >
                                <span className={styles.avatar} aria-hidden="true">
                                    {userInitial}
                                </span>
                                <span className={styles.userName}>{userLabel}</span>
                                <span className={styles.caret} aria-hidden="true" />
                            </button>
                            <div
                                className={`${styles.userMenu} ${
                                    isUserMenuOpen ? styles.userMenuOpen : ''
                                }`}
                            >
                                <div className={styles.userMenuMeta}>
                                    <div className={styles.userIdentity}>
                                        <span className={styles.metaValue}>{userLabel}</span>
                                        {roleLabel && <span className={styles.roleBadge}>{roleLabel}</span>}
                                    </div>
                                    <span className={styles.mutedLabel}>Account</span>
                                </div>
                                {role === 'CUSTOMER' && (
                                    <Link
                                        to="/my-page"
                                        className={styles.menuLink}
                                        onClick={handleNavLinkClick}
                                    >
                                        My Page
                                    </Link>
                                )}
                                <button type="button" className={styles.menuLink} disabled>
                                    Settings (coming soon)
                                </button>
                                <button
                                    type="button"
                                    className={styles.menuAction}
                                    onClick={logout}
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.authActions}>
                            <Link to="/login" className={styles.ghostButton}>
                                Login
                            </Link>
                            <Link to="/register" className={styles.primaryButton}>
                                Create account
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
