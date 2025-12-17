import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartLineItem from '../../components/store/CartLineItem.jsx';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import styles from './CartPage.module.css';

export default function CartPage() {
    const navigate = useNavigate();
    const { cart, pendingItemId, updateItemQuantity, removeItem } = useStorefront();
    const totals = cart?.totals || {};
    const currency = totals.currency || cart?.currency || 'SEK';
    const hasItems = (cart?.items?.length ?? 0) > 0;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Cart</p>
                    <h1>Your items</h1>
                    <p className={styles.subtitle}>Quantities, shipping, and totals stay in sync with our backend.</p>
                </div>
                <Link to="/store" className={styles.link}>Continue shopping</Link>
            </header>

            {!hasItems ? (
                <div className={styles.empty}>
                    <p>Cart is empty.</p>
                    <Link to="/store" className={styles.primary}>Browse products</Link>
                </div>
            ) : (
                <div className={styles.layout}>
                    <div className={styles.list}> 
                        {cart.items.map((item) => (
                            <CartLineItem
                                key={item.id || item.productId}
                                item={item}
                                currency={currency}
                                pending={pendingItemId === item.id}
                                onChangeQuantity={(qty) => updateItemQuantity(item.id, qty)}
                                onRemove={() => removeItem(item.id)}
                            />
                        ))}
                    </div>
                    <aside className={styles.summary}>
                        <h3>Order summary</h3>
                        <div className={styles.row}>
                            <span>Subtotal</span>
                            <span>{formatCurrency(totals.subtotal ?? totals.total ?? 0, currency)}</span>
                        </div>
                        {totals.shipping !== undefined && (
                            <div className={styles.row}>
                                <span>Shipping</span>
                                <span>{formatCurrency(totals.shipping, currency)}</span>
                            </div>
                        )}
                        <div className={`${styles.row} ${styles.total}`}>
                            <span>Total ({currencyLabel(currency)})</span>
                            <span>{formatCurrency(totals.total ?? totals.subtotal ?? 0, currency)}</span>
                        </div>
                        <button type="button" className={styles.cta} onClick={() => navigate('/store/checkout')}>
                            Proceed to checkout
                        </button>
                    </aside>
                </div>
            )}
        </div>
    );
}
