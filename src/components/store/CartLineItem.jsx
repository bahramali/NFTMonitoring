import React from 'react';
import QuantityStepper from './QuantityStepper.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import { getCartItemDisplayName } from '../../utils/storeVariants.js';
import { usePricingDisplay } from '../../context/PricingDisplayContext.jsx';
import { displayLineTotal, displayPrice, getPriceDisplaySuffix } from '../../utils/storePricingDisplay.js';
import styles from './CartLineItem.module.css';

export default function CartLineItem({ item, currency = 'SEK', onChangeQuantity, onRemove, pending, disabled = false }) {
    const { priceDisplayMode, vatRate } = usePricingDisplay();
    const quantity = item?.quantity ?? item?.qty ?? 1;
    const unitPrice = item?.discountedUnitPrice ?? item?.unitPrice ?? item?.price ?? 0;
    const lineTotal = item?.discountedLineTotal ?? item?.lineTotal ?? item?.total ?? null;
    const displayUnitPrice = displayPrice(unitPrice, vatRate, priceDisplayMode);
    const fallbackLineTotal = displayLineTotal(unitPrice, quantity, vatRate, priceDisplayMode);
    const resolvedLineTotal = lineTotal !== null
        ? displayPrice(lineTotal, vatRate, priceDisplayMode)
        : fallbackLineTotal;
    const priceLabel = formatCurrency(displayUnitPrice, currency);
    const totalLabel = formatCurrency(resolvedLineTotal, currency);
    const priceModeSuffix = getPriceDisplaySuffix(priceDisplayMode);
    const maxQuantity = item?.stock ?? item?.availableStock ?? item?.product?.stock;
    const displayName = getCartItemDisplayName(item);
    const isDisabled = pending || disabled;
    const handleQuantityChange = (nextQuantity) => {
        if (nextQuantity <= 0) {
            onRemove?.();
            return;
        }
        onChangeQuantity?.(nextQuantity);
    };

    return (
        <div className={styles.item}>
            <div className={styles.meta}>
                <div className={styles.thumb}>
                    {item?.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <span className={styles.dot} />}
                </div>
                <div>
                    <p className={styles.name}>{displayName}</p>
                    <p className={styles.price}>{priceLabel} ({priceModeSuffix})</p>
                    {item?.shortDescription ? <p className={styles.note}>{item.shortDescription}</p> : null}
                    <p className={styles.unit}>{currencyLabel(currency)}</p>
                </div>
            </div>
            <div className={styles.controls}>
                <QuantityStepper
                    value={quantity}
                    min={0}
                    max={maxQuantity ?? undefined}
                    onChange={handleQuantityChange}
                    compact
                    disabled={isDisabled}
                />
                <span className={styles.total}>{totalLabel}</span>
                <button
                    type="button"
                    className={styles.remove}
                    onClick={onRemove}
                    disabled={isDisabled}
                >
                    Remove
                </button>
            </div>
        </div>
    );
}
