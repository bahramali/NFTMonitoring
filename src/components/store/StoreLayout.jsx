import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import CartDrawer from './CartDrawer.jsx';
import Toast from './Toast.jsx';
import styles from './StoreLayout.module.css';

export default function StoreLayout() {
    const location = useLocation();
    const { isCartOpen, closeCart, toast, clearToast } = useStorefront();

    return (
        <div className={styles.shell}>
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
