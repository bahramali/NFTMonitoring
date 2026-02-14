import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartLineItem from '../../components/store/CartLineItem.jsx';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import styles from './CartPage.module.css';

export default function CartPage() {
    const navigate = useNavigate();
    const { cart, pendingItemId, updateItemQuantity, removeItem, startNewCart } = useStorefront();
    const totals = cart?.totals || {};
    const currency = totals.currency || cart?.currency || 'SEK';
    const hasItems = (cart?.items?.length ?? 0) > 0;
    const isCartClosed = Boolean(cart?.status && cart.status !== 'OPEN');
    const subtotal = totals.subtotal ?? totals.total ?? 0;
    const vat = totals.tax ?? 0;
    const net = Math.max(subtotal - vat, 0);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Cart</p>
                    <h1>Your items</h1>
                    <p className={styles.subtitle}>Quantities and totals update automatically.</p>
                </div>
                <Link to="/store" className={styles.link}>Continue shopping</Link>
            </header>

            {!hasItems ? (
                <div className={styles.empty}>
                    {isCartClosed && (
                        <div className={styles.closedNotice} role="status">
                            <span>Cart expired.</span>
                            <button type="button" className={styles.closedAction} onClick={startNewCart}>
                                Start new cart
                            </button>
                        </div>
                    )}
                    <p>Cart is empty.</p>
                    <Link to="/store" className={styles.primary}>Browse products</Link>
                </div>
            ) : (
                <div className={styles.layout}>
                    <div className={styles.list}> 
                        {isCartClosed && (
                            <div className={styles.closedNotice} role="status">
                                <span>Cart expired.</span>
                                <button type="button" className={styles.closedAction} onClick={startNewCart}>
                                    Start new cart
                                </button>
                            </div>
                        )}
                        {cart.items.map((item) => (
                            <CartLineItem
                                key={item.id || item.productId}
                                item={item}
                                currency={currency}
                                pending={pendingItemId === item.id}
                                disabled={isCartClosed}
                                onChangeQuantity={(qty) => updateItemQuantity(item.id, qty)}
                                onRemove={() => removeItem(item.id)}
                            />
                        ))}
                    </div>
                    <aside className={styles.summary}>
                        <h3>Order summary</h3>
                        <div className={styles.row}>
                            <span>Subtotal (excl. VAT / Net)</span>
                            <span>{formatCurrency(net, currency)}</span>
                        </div>
                        {totals.shipping !== undefined && (
                            <div className={styles.row}>
                                <span>Shipping</span>
                                <span>{formatCurrency(totals.shipping, currency)}</span>
                            </div>
                        )}
                        <div className={styles.row}>
                            <span>VAT (moms)</span>
                            <span>{formatCurrency(vat, currency)}</span>
                        </div>
                        <div className={`${styles.row} ${styles.total}`}>
                            <span>Total (incl. VAT / Gross · {currencyLabel(currency)})</span>
                            <span>{formatCurrency(totals.total ?? totals.subtotal ?? 0, currency)}</span>
                        </div>
                        <button
                            type="button"
                            className={styles.cta}
                            onClick={() => {
                                navigate('/store/checkout');
                            }}
                            disabled={!hasItems || isCartClosed}
                        >
                            Proceed to checkout
                        </button>
                    </aside>
                </div>
            )}
        </div>
    );
}
