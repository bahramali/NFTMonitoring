import React, { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import hydroleafLogo from '../../assets/hydroleaf_logo.png';
import { formatCurrency } from '../../utils/currency.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import CartDrawer from './CartDrawer.jsx';
import Toast from './Toast.jsx';
import styles from './StoreLayout.module.css';

export default function StoreLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { cart, isCartOpen, openCart, closeCart, toast, clearToast } = useStorefront();

    const itemCount = useMemo(() => cart?.items?.reduce((acc, item) => acc + (item.quantity ?? item.qty ?? 0), 0) || 0, [cart]);
    const totalLabel = useMemo(
        () => formatCurrency(cart?.totals?.total ?? cart?.totals?.subtotal ?? 0, cart?.totals?.currency || 'SEK'),
        [cart?.totals?.currency, cart?.totals?.subtotal, cart?.totals?.total],
    );

    return (
        <div className={styles.shell}>
            <header className={styles.header}>
                <div className={styles.container}>
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
                            <span className={styles.brandName}>HydroLeaf</span>
                            <span className={styles.brandNote}>Store</span>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" className={styles.cartButton} onClick={openCart}>
                            <span className={styles.cartLabel}>Cart</span>
                            <span className={styles.cartBadge}>{itemCount}</span>
                            <span className={styles.cartTotal}>{totalLabel} SEK</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className={styles.main} key={location.key}>
                <div className={styles.content}>
                    <Outlet />
                </div>
            </main>

            <CartDrawer open={isCartOpen} onClose={closeCart} />
            <Toast toast={toast} onDismiss={clearToast} />
        </div>
    );
}
