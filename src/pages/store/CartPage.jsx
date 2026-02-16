import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CartLineItem from '../../components/store/CartLineItem.jsx';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import { displayPrice, getPriceDisplaySuffix, resolveTotalsBreakdown } from '../../utils/storePricingDisplay.js';
import { usePricingDisplay } from '../../context/PricingDisplayContext.jsx';
import styles from './CartPage.module.css';

export default function CartPage() {
    const navigate = useNavigate();
    const { cart, pendingItemId, updateItemQuantity, removeItem, startNewCart } = useStorefront();
    const { customerType, priceDisplayMode, vatRate } = usePricingDisplay();
    const totals = cart?.totals || {};
    const currency = totals.currency || cart?.currency || 'SEK';
    const hasItems = (cart?.items?.length ?? 0) > 0;
    const isCartClosed = Boolean(cart?.status && cart.status !== 'OPEN');
    const pricingBreakdown = resolveTotalsBreakdown(totals);
    const vat = pricingBreakdown.vat;
    const net = pricingBreakdown.net;
    const gross = pricingBreakdown.gross;
    const isB2B = customerType === 'B2B';
    const priceModeSuffix = getPriceDisplaySuffix(priceDisplayMode);
    const payableTotal = displayPrice(gross, vatRate, priceDisplayMode);
    const displayedShipping = displayPrice(totals.shipping ?? 0, vatRate, priceDisplayMode);

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
                            <span>{isB2B ? 'Netto (exkl. moms)' : 'Delsumma (inkl. moms)'}</span>
                            <span>{formatCurrency(isB2B ? net : gross, currency)}</span>
                        </div>
                        {totals.shipping !== undefined && (
                            <div className={styles.row}>
                                <span>Frakt</span>
                                <span>{formatCurrency(displayedShipping, currency)}</span>
                            </div>
                        )}
                        {isB2B ? (
                            <div className={styles.row}>
                                <span>Moms</span>
                                <span>{formatCurrency(vat, currency)}</span>
                            </div>
                        ) : null}
                        <div className={`${styles.row} ${styles.total}`}>
                            <span>Att betala ({priceModeSuffix} · {currencyLabel(currency)})</span>
                            <span>{formatCurrency(payableTotal, currency)}</span>
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
