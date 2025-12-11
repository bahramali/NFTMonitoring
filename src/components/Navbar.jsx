import React, { useMemo } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import hydroleafLogo from '../assets/hydroleaf_logo.png';
import styles from './Navbar.module.css';

const ADMIN_PAGES = [
    { path: '/admin/dashboard', label: 'Admin Dashboard', permission: 'admin-dashboard' },
    { path: '/admin/team', label: 'Team', permission: 'admin-team' },
];

export default function Navbar() {
    const {
        isAuthenticated,
        userId,
        role,
        permissions,
        logout,
    } = useAuth();

    const adminLinks = useMemo(() => {
        if (role === 'SUPER_ADMIN') {
            return [
                { path: '/dashboard/overview', label: 'Monitoring Dashboard' },
                ...ADMIN_PAGES,
            ];
        }

        if (role === 'ADMIN') {
            const monitoringLinks = permissions?.includes('admin-dashboard')
                ? [{ path: '/dashboard/overview', label: 'Monitoring Dashboard' }]
                : [];

            return [
                ...monitoringLinks,
                ...ADMIN_PAGES.filter((page) => permissions?.includes(page.permission)),
            ];
        }
        return [];
    }, [permissions, role]);

    const handleLogout = () => {
        logout();
    };

    return (
        <header className={styles.header}>
            <div className={styles.brandRow}>
                <Link to="/" className={styles.brand}>
                    <img src={hydroleafLogo} alt="HydroLeaf logo" className={styles.brandLogo} />
                    <span className={styles.brandName}>HydroLeaf Shop</span>
                </Link>
                <nav className={styles.navLinks}>
                    <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : '')}>
                        Home
                    </NavLink>
                    {!isAuthenticated && (
                        <NavLink to="/login" className={({ isActive }) => (isActive ? styles.active : '')}>
                            Login
                        </NavLink>
                    )}
                    {!isAuthenticated && (
                        <NavLink to="/register" className={({ isActive }) => (isActive ? styles.active : '')}>
                            Register
                        </NavLink>
                    )}
                    {role === 'SUPER_ADMIN' && (
                        <>
                            <NavLink
                                to="/super-admin"
                                className={({ isActive }) => (isActive ? styles.active : '')}
                            >
                                Super Admin
                            </NavLink>
                            <NavLink
                                to="/super-admin/admins"
                                className={({ isActive }) => (isActive ? styles.active : '')}
                            >
                                Admin Management
                            </NavLink>
                        </>
                    )}
                    {adminLinks.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            className={({ isActive }) => (isActive ? styles.active : '')}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                    {role === 'WORKER' && (
                        <NavLink
                            to="/worker/dashboard"
                            className={({ isActive }) => (isActive ? styles.active : '')}
                        >
                            Worker Dashboard
                        </NavLink>
                    )}
                    {role === 'CUSTOMER' && (
                        <NavLink to="/my-page" className={({ isActive }) => (isActive ? styles.active : '')}>
                            My Page
                        </NavLink>
                    )}
                </nav>
                <div className={styles.authSection}>
                    {isAuthenticated ? (
                        <>
                            <div className={styles.identity}>
                                <span className={styles.roleBadge}>{role}</span>
                                <span className={styles.username}>{userId}</span>
                            </div>
                            <button type="button" className={styles.button} onClick={handleLogout}>
                                Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className={styles.button}>Login</Link>
                    )}
                </div>
            </div>
        </header>
    );
}
