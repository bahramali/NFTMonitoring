import React from 'react';
import QuantityStepper from './QuantityStepper.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import { getCartItemDisplayName } from '../../utils/storeVariants.js';
import styles from './CartLineItem.module.css';

export default function CartLineItem({ item, currency = 'SEK', onChangeQuantity, onRemove, pending }) {
    const quantity = item?.quantity ?? item?.qty ?? 1;
    const unitPrice = item?.price ?? item?.unitPrice ?? 0;
    const lineTotal = item?.total ?? item?.lineTotal ?? null;
    const priceLabel = formatCurrency(unitPrice, currency);
    const totalLabel = lineTotal !== null ? formatCurrency(lineTotal, currency) : formatCurrency(unitPrice * quantity, currency);
    const maxQuantity = item?.stock ?? item?.availableStock ?? item?.product?.stock;
    const displayName = getCartItemDisplayName(item);
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
                    <p className={styles.price}>{priceLabel}</p>
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
                    disabled={pending}
                />
                <span className={styles.total}>{totalLabel}</span>
                <button
                    type="button"
                    className={styles.remove}
                    onClick={onRemove}
                    disabled={pending}
                >
                    Remove
                </button>
            </div>
        </div>
    );
}
