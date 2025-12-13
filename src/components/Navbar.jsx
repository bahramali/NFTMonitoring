import React, { useMemo } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import hydroleafLogo from '../assets/hydroleaf_logo.png';
import styles from './Navbar.module.css';

const ADMIN_PAGES = [
    { path: '/admin/dashboard', label: 'Admin Dashboard', permission: 'ADMIN_DASHBOARD' },
    { path: '/dashboard/reports', label: 'Reports', permission: 'ADMIN_REPORTS' },
    { path: '/admin/team', label: 'Team', permission: 'ADMIN_TEAM' },
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
            const monitoringLinks = permissions?.includes('ADMIN_DASHBOARD')
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
            <div className={styles.container}>
                <Link to="/" className={styles.brand}>
                    <img src={hydroleafLogo} alt="HydroLeaf logo" className={styles.brandLogo} />
                    <div className={styles.brandCopy}>
                        <span className={styles.brandName}>HydroLeaf Shop</span>
                        <span className={styles.tagline}>NFT Monitoring Platform</span>
                    </div>
                </Link>

                <div className={styles.navWrapper}>
                    <nav className={styles.navLinks}>
                        <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : '')}>
                            Home
                        </NavLink>
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
                        {!isAuthenticated && (
                            <NavLink to="/register" className={({ isActive }) => (isActive ? styles.active : '')}>
                                Register
                            </NavLink>
                        )}
                    </nav>
                </div>

                <div className={styles.authSection}>
                    {isAuthenticated ? (
                        <>
                            <div className={styles.identity}>
                                <div className={styles.identityText}>
                                    <span className={styles.identityLabel}>Signed in as</span>
                                    <span className={styles.identityValue}>{userId ? `User #${userId}` : 'Account'}</span>
                                </div>
                                <span className={styles.roleBadge}>{role?.replace('_', ' ')}</span>
                            </div>
                            <button type="button" className={styles.button} onClick={handleLogout}>
                                Logout
                            </button>
                        </>
                    ) : (
                        <div className={styles.authActions}>
                            <Link to="/login" className={styles.buttonOutline}>Login</Link>
                            <Link to="/register" className={styles.button}>Create account</Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
