import React from 'react';
import { Outlet } from 'react-router-dom';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import CartDrawer from './CartDrawer.jsx';
import Toast from './Toast.jsx';
import Footer from './Footer.jsx';
import styles from './StoreLayout.module.css';

export default function StoreLayout() {
    const { isCartOpen, closeCart, toast, clearToast } = useStorefront();

    return (
        <div className={styles.shell}>
            <main className={styles.main}>
                <div className={styles.content}>
                    <Outlet />
                </div>
            </main>

            <Footer />
            <CartDrawer open={isCartOpen} onClose={closeCart} />
            <Toast toast={toast} onDismiss={clearToast} />
        </div>
    );
}
