import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import CartLineItem from './CartLineItem.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import styles from './CartDrawer.module.css';

export default function CartDrawer({ open, onClose }) {
    const navigate = useNavigate();
    const { cart, pendingItemId, updateItemQuantity, removeItem } = useStorefront();

    const totals = cart?.totals || {};
    const currency = totals.currency || cart?.currency || 'SEK';
    const hasItems = (cart?.items?.length ?? 0) > 0;

    return (
        <div className={`${styles.backdrop} ${open ? styles.open : ''}`}>
            <aside className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}>
                <div className={styles.header}>
                    <div>
                        <p className={styles.kicker}>Your cart</p>
                        <h3 className={styles.title}>Review items before checkout</h3>
                    </div>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Close cart">
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.body}>
                        {!hasItems ? (
                            <div className={styles.empty}>
                                <p>Cart is empty.</p>
                                <button type="button" onClick={() => { onClose?.(); navigate('/store'); }}>
                                    Continue shopping
                                </button>
                            </div>
                        ) : (
                            cart.items.map((item) => (
                                <CartLineItem
                                    key={item.id || item.productId}
                                    item={item}
                                    currency={currency}
                                    pending={pendingItemId === item.id}
                                    onChangeQuantity={(qty) => updateItemQuantity(item.id, qty)}
                                    onRemove={() => removeItem(item.id)}
                                />
                            ))
                        )}
                    </div>

                    <div className={styles.footer}>
                        <div className={styles.summaryRow}>
                            <span>Subtotal</span>
                            <span className={styles.value}>{formatCurrency(totals.subtotal ?? totals.total ?? 0, currency)}</span>
                        </div>
                        {totals.shipping !== undefined && (
                            <div className={styles.summaryRow}>
                                <span>Shipping estimate</span>
                                <span className={styles.value}>{formatCurrency(totals.shipping, currency)}</span>
                            </div>
                        )}
                        <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                            <span>Total ({currencyLabel(currency)})</span>
                            <span className={styles.total}>{formatCurrency(totals.total ?? totals.subtotal ?? 0, currency)}</span>
                        </div>

                        <button
                            type="button"
                            className={styles.checkout}
                            onClick={() => {
                                onClose?.();
                                navigate('/store/checkout');
                            }}
                            disabled={!hasItems}
                        >
                            Go to checkout
                        </button>
                        <p className={styles.meta}>Secure checkout · Prices in SEK</p>
                    </div>
                </div>
            </aside>
        </div>
    );
}
