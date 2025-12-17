import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import hydroleafLogo from '../../assets/hydroleaf_logo.png';
import { formatCurrency } from '../../utils/currency.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import CartDrawer from './CartDrawer.jsx';
import Toast from './Toast.jsx';
import styles from './StoreLayout.module.css';

const navItems = [
    { path: '/store', label: 'Products' },
    { path: '/store/checkout', label: 'Checkout' },
];

export default function StoreLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { cart, isCartOpen, openCart, closeCart, toast, clearToast } = useStorefront();

    const itemCount = useMemo(() => cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0, [cart]);
    const totalLabel = useMemo(() => formatCurrency(cart?.totals?.total ?? cart?.totals?.subtotal ?? 0, cart?.totals?.currency || 'SEK'), [cart?.totals?.currency, cart?.totals?.subtotal, cart?.totals?.total]);

    return (
        <div className={styles.shell}>
            <div className={styles.gradient} aria-hidden="true" />
            <header className={styles.header}>
                <div
                    className={styles.brand}
                    onClick={() => navigate('/store')}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            navigate('/store');
                        }
                    }}
                    role="button"
                    tabIndex={0}
                >
                    <img src={hydroleafLogo} alt="HydroLeaf" />
                    <div>
                        <span className={styles.brandName}>HydroLeaf Store</span>
                        <span className={styles.brandNote}>Basil & hydroponic gear</span>
                    </div>
                </div>

                <nav className={styles.nav}>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className={styles.actions}>
                    <button type="button" className={styles.cartButton} onClick={openCart}>
                        <span className={styles.cartLabel}>Cart</span>
                        <span className={styles.cartBadge}>{itemCount}</span>
                        <span className={styles.cartTotal}>{totalLabel} SEK</span>
                    </button>
                    <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => navigate('/dashboard/overview')}
                    >
                        Dashboard
                    </button>
                </div>
            </header>

            <main className={styles.main} key={location.key}>
                <Outlet />
            </main>

            <CartDrawer open={isCartOpen} onClose={closeCart} />
            <Toast toast={toast} onDismiss={clearToast} />
        </div>
    );
}
