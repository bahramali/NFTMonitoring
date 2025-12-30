import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStorefront } from '../context/StorefrontContext.jsx';
import hydroleafLogo from '../assets/hydroleaf_logo.png';
import styles from './Navbar.module.css';
import { PERMISSIONS, hasPerm } from '../utils/permissions.js';
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
        path: '/monitoring/overview',
        label: 'Monitoring',
        requiresAuth: true,
        permissions: [PERMISSIONS.MONITORING_VIEW],
    },
];

const ADMIN_MENU = [
    {
        path: '/admin/overview',
        label: 'Admin Overview',
        permissions: [PERMISSIONS.ADMIN_OVERVIEW_VIEW],
    },
    {
        path: '/admin/team',
        label: 'Admin Management',
        permissions: [PERMISSIONS.ADMIN_PERMISSIONS_MANAGE],
    },
    {
        path: '/store/admin/products',
        label: 'Products',
        permissions: [PERMISSIONS.PRODUCTS_MANAGE],
    },
    {
        path: '/store/admin/customers',
        label: 'Customers',
        permissions: [PERMISSIONS.CUSTOMERS_VIEW],
    },
    { path: '/admin/tools', label: 'Super Admin Tools', roles: ['SUPER_ADMIN'] },
    { path: '/admin/directory', label: 'Admin Directory', roles: ['SUPER_ADMIN'] },
];

const hasAccess = (item, role, roles = [], permissions = []) => {
    const availableRoles = roles.length > 0 ? roles : role ? [role] : [];
    const isSuperAdmin = availableRoles.includes('SUPER_ADMIN');

    if (item?.roles?.length > 0) {
        const matchesRole = availableRoles.some((userRole) => item.roles.includes(userRole));
        if (!matchesRole) return false;
    }

    if (!item?.permissions || item.permissions.length === 0) return true;
    if (isSuperAdmin) return true;

    const me = { permissions };
    return item.permissions.every((permission) => hasPerm(me, permission));
};

export default function Navbar() {
    const { isAuthenticated, role, roles, permissions, logout, profile, loadingProfile } = useAuth();
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
    const profileLabel = profile?.username || profile?.fullName || profile?.displayName || profile?.email || '';
    const userLabel = profileLabel || 'User';
    const userInitial = profileLabel?.trim()?.charAt(0)?.toUpperCase() || 'U';
    const showProfileSkeleton = loadingProfile && !profileLabel;

    const primaryLinks = useMemo(() => {
        return NAV_ITEMS.filter((item) => {
            if (item.requiresAuth && !isAuthenticated) return false;
            return hasAccess(item, role, roles, permissions);
        });
    }, [isAuthenticated, permissions, role, roles]);

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
        return ADMIN_MENU.filter((item) => hasAccess(item, role, roles, permissions));
    }, [isAuthenticated, permissions, role, roles]);

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
                    <Link
                        to="/store"
                        className={styles.brand}
                        aria-label="Go to store"
                        onClick={handleNavLinkClick}
                    >
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
                            {itemCount > 0 && (
                                <span className={styles.storeCartTotal}>{totalLabel}</span>
                            )}
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
                                {showProfileSkeleton ? (
                                    <span
                                        className={styles.userNameSkeleton}
                                        role="status"
                                        aria-label="Loading profile"
                                    />
                                ) : (
                                    <span className={styles.userName}>{userLabel}</span>
                                )}
                                <span className={styles.caret} aria-hidden="true" />
                            </button>
                            <div
                                className={`${styles.userMenu} ${
                                    isUserMenuOpen ? styles.userMenuOpen : ''
                                }`}
                            >
                                <div className={styles.userMenuMeta}>
                                    <div className={styles.userIdentity}>
                                        {showProfileSkeleton ? (
                                            <span
                                                className={styles.metaValueSkeleton}
                                                role="status"
                                                aria-label="Loading profile"
                                            />
                                        ) : (
                                            <span className={styles.metaValue}>{userLabel}</span>
                                        )}
                                        {roleLabel && <span className={styles.roleBadge}>{roleLabel}</span>}
                                    </div>
                                    <span className={styles.mutedLabel}>Account</span>
                                </div>
                                {role === 'CUSTOMER' && (
                                    <>
                                        <Link
                                            to="/my-page"
                                            className={styles.menuLink}
                                            onClick={handleNavLinkClick}
                                        >
                                            My Account
                                        </Link>
                                    </>
                                )}
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
                            <Link to="/register" className={`${styles.ghostButton} ${styles.subtleButton}`}>
                                Create account
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
