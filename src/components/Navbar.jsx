import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import hydroleafLogo from '../assets/hydroleaf_logo.png';
import styles from './Navbar.module.css';

const NAV_ITEMS = [
    { path: '/', label: 'Home', requiresAuth: false },
    {
        path: '/dashboard/overview',
        label: 'Monitoring',
        requiresAuth: true,
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: ['ADMIN_DASHBOARD'],
    },
    {
        path: '/dashboard/reports',
        label: 'Reports',
        requiresAuth: true,
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: ['ADMIN_REPORTS'],
    },
    {
        path: '/team',
        label: 'Team',
        requiresAuth: true,
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: ['ADMIN_TEAM'],
    },
];

const ADMIN_MENU = [
    {
        path: '/admin',
        label: 'Admin Dashboard',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: ['ADMIN_DASHBOARD'],
    },
    {
        path: '/admin/team',
        label: 'Admin Management',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: ['ADMIN_TEAM'],
    },
    { path: '/super-admin', label: 'Super Admin Tools', roles: ['SUPER_ADMIN'] },
    { path: '/super-admin/admins', label: 'Admin Directory', roles: ['SUPER_ADMIN'] },
];

const hasAccess = (item, role, permissions = []) => {
    if (!item?.roles || item.roles.length === 0) return true;
    if (!role || !item.roles.includes(role)) return false;

    if (item.permissions && item.permissions.length > 0) {
        return item.permissions.every((permission) => permissions?.includes(permission));
    }

    return true;
};

export default function Navbar() {
    const { isAuthenticated, userId, role, permissions, logout } = useAuth();
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const location = useLocation();

    const roleLabel = role ? role.replace('_', ' ') : '';
    const userLabel = userId ? `User #${userId}` : 'Account';

    const primaryLinks = useMemo(() => {
        return NAV_ITEMS.filter((item) => {
            if (item.requiresAuth && !isAuthenticated) return false;
            return hasAccess(item, role, permissions);
        });
    }, [isAuthenticated, permissions, role]);

    const adminLinks = useMemo(() => {
        if (!isAuthenticated) return [];
        return ADMIN_MENU.filter((item) => hasAccess(item, role, permissions));
    }, [isAuthenticated, permissions, role]);

    useEffect(() => {
        setIsNavOpen(false);
        setIsAdminOpen(false);
        setIsUserMenuOpen(false);
    }, [location.pathname]);

    const navLinkClassName = ({ isActive }) =>
        [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ');

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
                                <NavLink key={item.path} to={item.path} className={navLinkClassName}>
                                    {item.label}
                                </NavLink>
                            ))}

                            {adminLinks.length > 0 && (
                                <div className={styles.dropdown}>
                                    <button
                                        type="button"
                                        className={styles.dropdownTrigger}
                                        aria-expanded={isAdminOpen}
                                        onClick={() => setIsAdminOpen((open) => !open)}
                                    >
                                        Admin
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
                    {isAuthenticated ? (
                        <div className={styles.userArea}>
                            <button
                                type="button"
                                className={styles.userButton}
                                aria-expanded={isUserMenuOpen}
                                onClick={() => setIsUserMenuOpen((open) => !open)}
                            >
                                <span className={styles.userName}>{userLabel}</span>
                                {roleLabel && <span className={styles.rolePill}>{roleLabel}</span>}
                            </button>
                            <div
                                className={`${styles.userMenu} ${
                                    isUserMenuOpen ? styles.userMenuOpen : ''
                                }`}
                            >
                                <div className={styles.userMenuMeta}>
                                    <span className={styles.mutedLabel}>Signed in as</span>
                                    <span className={styles.metaValue}>{userLabel}</span>
                                </div>
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
