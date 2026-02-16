import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import CartLineItem from './CartLineItem.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import { usePricingDisplay } from '../../context/PricingDisplayContext.jsx';
import { displayPrice, getPriceDisplaySuffix, resolveTotalsBreakdown } from '../../utils/storePricingDisplay.js';
import styles from './CartDrawer.module.css';

export default function CartDrawer({ open, onClose }) {
    const navigate = useNavigate();
    const { cart, pendingItemId, updateItemQuantity, removeItem, startNewCart } = useStorefront();
    const { priceDisplayMode, vatRate } = usePricingDisplay();

    const totals = cart?.totals || {};
    const currency = totals.currency || cart?.currency || 'SEK';
    const hasItems = (cart?.items?.length ?? 0) > 0;
    const isCartClosed = Boolean(cart?.status && cart.status !== 'OPEN');
    const canMutateCart = open && cart?.status === 'OPEN';
    const { net } = resolveTotalsBreakdown(totals);
    const subtotalDisplay = displayPrice(net, vatRate, priceDisplayMode);
    const totalDisplay = displayPrice(net, vatRate, priceDisplayMode);
    const shippingDisplay = displayPrice(totals.shipping ?? 0, vatRate, priceDisplayMode);

    const handleQuantityChange = (itemId, qty) => {
        if (!canMutateCart) return;
        updateItemQuantity(itemId, qty);
    };

    const handleRemoveItem = (itemId) => {
        if (!canMutateCart) return;
        removeItem(itemId);
    };

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
                        {isCartClosed && (
                            <div className={styles.closedNotice} role="status">
                                <span>Cart expired.</span>
                                <button type="button" className={styles.closedAction} onClick={startNewCart}>
                                    Start new cart
                                </button>
                            </div>
                        )}
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
                                    disabled={isCartClosed}
                                    onChangeQuantity={(qty) => handleQuantityChange(item.id, qty)}
                                    onRemove={() => handleRemoveItem(item.id)}
                                />
                            ))
                        )}
                    </div>

                    <div className={styles.footer}>
                        <div className={styles.summaryRow}>
                            <span>Subtotal ({getPriceDisplaySuffix(priceDisplayMode)})</span>
                            <span className={styles.value}>{formatCurrency(subtotalDisplay, currency)}</span>
                        </div>
                        {totals.shipping !== undefined && (
                            <div className={styles.summaryRow}>
                                <span>Shipping estimate</span>
                                <span className={styles.value}>{formatCurrency(shippingDisplay, currency)}</span>
                            </div>
                        )}
                        <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                            <span>Total ({getPriceDisplaySuffix(priceDisplayMode)} · {currencyLabel(currency)})</span>
                            <span className={styles.total}>{formatCurrency(totalDisplay, currency)}</span>
                        </div>

                        <button
                            type="button"
                            className={styles.checkout}
                            onClick={() => {
                                onClose?.();
                                navigate('/store/checkout');
                            }}
                            disabled={!hasItems || isCartClosed}
                        >
                            Go to checkout
                        </button>
                        <p className={styles.meta}>Secure checkout · Prices in SEK ({getPriceDisplaySuffix(priceDisplayMode)})</p>
                    </div>
                </div>
            </aside>
        </div>
    );
}
