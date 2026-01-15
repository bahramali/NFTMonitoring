import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStorefront } from '../context/StorefrontContext.jsx';
const hydroleafLogo = 'https://pic.hydroleaf.se/logo-mark.png';
import styles from './Navbar.module.css';
import { PERMISSIONS, hasPerm } from '../utils/permissions.js';
import { formatCurrency } from '../utils/currency.js';
import { hasInternalAccess } from '../utils/roleAccess.js';

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
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userButtonRef = useRef(null);
    const userMenuRef = useRef(null);
    const [menuStyles, setMenuStyles] = useState({ visibility: 'hidden' });
    const location = useLocation();
    const isStoreRoute = location.pathname === '/store' || location.pathname.startsWith('/store/');
    const availableRoles = roles?.length ? roles : role ? [role] : [];
    const isSuperAdmin = availableRoles.includes('SUPER_ADMIN');
    const hasRoleInfo = (roles?.length ?? 0) > 0 || Boolean(role);
    const canRenderInternalTabs = !loadingProfile || hasRoleInfo;
    const showInternalTabs = canRenderInternalTabs && isAuthenticated && hasInternalAccess({ role, roles });

    const roleLabel = role ? role.replace('_', ' ') : '';
    const profileLabel = profile?.displayName || profile?.fullName || profile?.username || profile?.email || '';
    const userLabel = profileLabel || 'User';
    const userInitial = profileLabel?.trim()?.charAt(0)?.toUpperCase() || 'U';
    const emailLabel = profile?.email?.trim() || '';
    const menuHeaderLabel =
        profile?.displayName || profile?.fullName || emailLabel || profile?.username || 'Account';
    const showProfileSkeleton = loadingProfile && !profileLabel;

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
    const canAccessAdmin = adminLinks.length > 0;
    const canSeeMonitoring = isSuperAdmin || hasPerm({ permissions }, PERMISSIONS.MONITORING_VIEW);
    const accountLink = role === 'CUSTOMER' ? '/account' : '/monitoring/overview';

    useEffect(() => {
        setIsUserMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const isButtonClick = userButtonRef.current?.contains(event.target);
            const isMenuClick = userMenuRef.current?.contains(event.target);
            if (!isButtonClick && !isMenuClick) {
                setIsUserMenuOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    useEffect(() => {
        if (!isUserMenuOpen) {
            return;
        }

        const updateMenuPosition = () => {
            const button = userButtonRef.current;
            const menu = userMenuRef.current;
            if (!button || !menu) return;

            const rect = button.getBoundingClientRect();
            const menuRect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const top = rect.bottom + 6;
            const maxWidth = Math.max(viewportWidth - 16, 0);
            const menuWidth = Math.min(menuRect.width, maxWidth);
            const maxRight = Math.max(viewportWidth - menuWidth - 8, 8);
            const baseRight = viewportWidth - rect.right;
            const right = Math.min(Math.max(baseRight, 8), maxRight);
            const maxHeight = Math.max(viewportHeight - top - 12, 0);

            setMenuStyles({
                top: `${top}px`,
                right: `${right}px`,
                maxHeight: maxHeight ? `${maxHeight}px` : undefined,
                visibility: 'visible',
            });
        };

        updateMenuPosition();
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);
        return () => {
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [isUserMenuOpen]);

    const handleNavLinkClick = () => {
        setIsUserMenuOpen(false);
    };

    const moduleTabClass = ({ isActive }) => `${styles.moduleTab} ${isActive ? styles.moduleTabActive : ''}`;

    return (
        <header className="topbar">
            <div className="topbar__inner">
                <div className="topbar__left">
                    <Link
                        to="/"
                        className={styles.brand}
                        aria-label="Go to home"
                        onClick={handleNavLinkClick}
                    >
                        <img src={hydroleafLogo} alt="HydroLeaf logo" className={styles.brandLogo} />
                        <span className={styles.brandName}>HydroLeaf</span>
                    </Link>
                </div>

                <div className="topbar__center">
                    <NavLink to="/" className={moduleTabClass} onClick={handleNavLinkClick} end>
                        Home
                    </NavLink>
                    <NavLink to="/store" className={moduleTabClass} onClick={handleNavLinkClick}>
                        Store
                    </NavLink>
                    <NavLink to="/about" className={moduleTabClass} onClick={handleNavLinkClick}>
                        About
                    </NavLink>
                    <NavLink to="/contact" className={moduleTabClass} onClick={handleNavLinkClick}>
                        Contact
                    </NavLink>
                    {showInternalTabs && (
                        <>
                            {canSeeMonitoring && (
                                <NavLink to="/monitoring/overview" className={moduleTabClass} onClick={handleNavLinkClick}>
                                    Monitoring
                                </NavLink>
                            )}
                            {canSeeMonitoring && (
                                <NavLink to="/monitoring/reports" className={moduleTabClass} onClick={handleNavLinkClick}>
                                    Reports
                                </NavLink>
                            )}
                            {canAccessAdmin && (
                                <NavLink to="/admin/overview" className={moduleTabClass} onClick={handleNavLinkClick}>
                                    Admin
                                </NavLink>
                            )}
                        </>
                    )}
                </div>

                <div className="topbar__right">
                    {isStoreRoute && (
                        <button
                            type="button"
                            className={styles.cartIconButton}
                            onClick={openCart}
                            aria-label="Open cart"
                        >
                            <span className={styles.cartIcon} aria-hidden="true">
                                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                                    <path
                                        d="M6.5 6h13l-1.3 7.1a2 2 0 0 1-2 1.7H9.1a2 2 0 0 1-2-1.6L5.1 4H3"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <circle cx="9" cy="19" r="1.4" fill="currentColor" />
                                    <circle cx="16.5" cy="19" r="1.4" fill="currentColor" />
                                </svg>
                            </span>
                            {itemCount > 0 && (
                                <span className={styles.cartBadge} aria-label={`${itemCount} items in cart`}>
                                    {itemCount}
                                </span>
                            )}
                            {itemCount > 0 && <span className={styles.cartTotal}>{totalLabel}</span>}
                        </button>
                    )}
                    {isAuthenticated ? (
                        <div className={styles.userArea}>
                            <button
                                type="button"
                                className={`${styles.userButton} ${isStoreRoute ? styles.userButtonCompact : ''}`}
                                aria-expanded={isUserMenuOpen}
                                aria-haspopup="menu"
                                aria-label="Account"
                                title="Account"
                                ref={userButtonRef}
                                onClick={() => {
                                    setIsUserMenuOpen((open) => !open);
                                }}
                            >
                                <span className={styles.avatarWrapper} aria-hidden="true">
                                    <span className={styles.avatar}>{userInitial}</span>
                                    <span className={styles.avatarStatus} />
                                </span>
                                {!isStoreRoute &&
                                    (showProfileSkeleton ? (
                                        <span
                                            className={styles.userNameSkeleton}
                                            role="status"
                                            aria-label="Loading profile"
                                        />
                                    ) : (
                                        <span className={styles.userName}>{userLabel}</span>
                                    ))}
                                <span className={styles.caret} aria-hidden="true" />
                            </button>
                            {isUserMenuOpen &&
                                createPortal(
                                    <div
                                        className={styles.userMenu}
                                        ref={userMenuRef}
                                        style={menuStyles}
                                        role="menu"
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
                                                    <span className={styles.metaValue} title={menuHeaderLabel}>
                                                        {menuHeaderLabel}
                                                    </span>
                                                )}
                                                {roleLabel && !isStoreRoute && (
                                                    <span className={styles.roleBadge}>{roleLabel}</span>
                                                )}
                                            </div>
                                            <span className={styles.mutedLabel}>Account</span>
                                        </div>
                                        <Link
                                            to={accountLink}
                                            className={styles.menuLink}
                                            onClick={handleNavLinkClick}
                                        >
                                            My account
                                        </Link>
                                        {role === 'CUSTOMER' && (
                                            <Link
                                                to="/account/orders"
                                                className={styles.menuLink}
                                                onClick={handleNavLinkClick}
                                            >
                                                Orders
                                            </Link>
                                        )}
                                        {canAccessAdmin && !isStoreRoute && (
                                            <Link
                                                to="/admin"
                                                className={styles.menuLink}
                                                onClick={handleNavLinkClick}
                                            >
                                                Admin Console
                                            </Link>
                                        )}
                                        <button
                                            type="button"
                                            className={styles.menuAction}
                                            onClick={logout}
                                        >
                                            Sign out
                                        </button>
                                    </div>,
                                    document.body,
                                )}
                        </div>
                    ) : isStoreRoute ? (
                        <Link
                            to="/login"
                            className={styles.accountIconButton}
                            aria-label="Sign in"
                            title="Sign in"
                        >
                            <span className={styles.accountIcon} aria-hidden="true">
                                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                                    <circle
                                        cx="12"
                                        cy="8"
                                        r="3.2"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                    />
                                    <path
                                        d="M5 19.5c1.7-3.2 5-5.1 7-5.1s5.3 1.9 7 5.1"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                        </Link>
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
