import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QuantityStepper from './QuantityStepper.jsx';
import { formatCurrency } from '../../utils/currency.js';
import {
    getActiveVariants,
    getDefaultVariantId,
    getVariantLabel,
    getVariantPrice,
    getVariantStock,
    isVariantInStock,
} from '../../utils/storeVariants.js';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, onAdd, pending = false, layout = 'grid' }) {
    const [quantity, setQuantity] = useState(1);
    const variants = useMemo(() => getActiveVariants(product), [product]);
    const defaultVariantId = useMemo(() => getDefaultVariantId(variants), [variants]);
    const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);

    const { name, id, imageUrl, currency } = product || {};
    const activeVariant = useMemo(
        () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
        [selectedVariantId, variants],
    );
    const priceValue = getVariantPrice(activeVariant) ?? product?.price ?? 0;
    const stockValue = activeVariant ? getVariantStock(activeVariant) : product?.stock;
    const isOutOfStock = stockValue !== undefined && stockValue <= 0;
    const stockLabel = useMemo(() => {
        if (stockValue === undefined) return 'In stock';
        if (stockValue <= 0) return 'Out of stock';
        if (stockValue <= 10) return `Only ${stockValue} left`;
        return 'In stock';
    }, [stockValue]);
    const priceLabel = useMemo(() => formatCurrency(priceValue, currency || 'SEK'), [currency, priceValue]);

    const { title, badge } = useMemo(() => {
        const safeName = name ? String(name).trim() : '';
        if (!safeName) return { title: '', badge: '' };
        const parts = safeName.split(/\s*[–-]\s*/);
        if (parts.length <= 1) return { title: safeName, badge: '' };
        const [first, ...rest] = parts;
        return { title: first.trim(), badge: rest.join(' - ').trim() };
    }, [name]);

    useEffect(() => {
        setSelectedVariantId((current) => {
            if (current && variants.some((variant) => variant.id === current)) {
                return current;
            }
            return defaultVariantId;
        });
    }, [defaultVariantId, variants]);

    useEffect(() => {
        if (stockValue !== undefined && stockValue > 0 && quantity > stockValue) {
            setQuantity(stockValue);
        }
        if (stockValue !== undefined && stockValue <= 0) {
            setQuantity(1);
        }
    }, [quantity, stockValue]);

    const showMaxNotice = stockValue !== undefined && stockValue > 0 && quantity >= stockValue;
    const showVariantSelector = variants.length > 1;
    const useDropdown = variants.length > 4;

    return (
        <article className={`${styles.card} ${layout === 'single' ? styles.cardSingle : ''}`}>
            <div className={styles.media}>
                {imageUrl ? (
                    <img src={imageUrl} alt={name} />
                ) : (
                    <div className={styles.placeholder} aria-hidden="true">
                        <span className={styles.logoDot} />
                    </div>
                )}
            </div>

            <div className={styles.body}>
                <div className={styles.headerRow}>
                    <div>
                        <h3 className={styles.name}>{title}</h3>
                        {badge ? <span className={styles.badge}>{badge}</span> : null}
                    </div>
                    <div className={styles.price}>
                        <span className={styles.priceValue}>{priceLabel}</span>
                    </div>
                </div>

                <div className={styles.buyFooter}>
                    {showVariantSelector ? (
                        <div className={styles.variantRow}>
                            <span className={styles.variantLabel}>Weight</span>
                            {useDropdown ? (
                                <select
                                    className={styles.variantSelect}
                                    value={selectedVariantId ?? ''}
                                    onChange={(event) => setSelectedVariantId(event.target.value)}
                                >
                                    {variants.map((variant) => (
                                        <option key={variant.id} value={variant.id}>
                                            {getVariantLabel(variant)}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className={styles.variantChips} role="group" aria-label="Select weight">
                                    {variants.map((variant) => {
                                        const label = getVariantLabel(variant);
                                        const isSelected = variant.id === selectedVariantId;
                                        const isInStock = isVariantInStock(variant);
                                        return (
                                            <button
                                                key={variant.id}
                                                type="button"
                                                className={`${styles.variantChip} ${isSelected ? styles.variantChipActive : ''} ${!isInStock ? styles.variantChipMuted : ''}`}
                                                onClick={() => setSelectedVariantId(variant.id)}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : null}
                    <div className={styles.buySection}>
                        <span className={`${styles.stock} ${isOutOfStock ? styles.stockMuted : ''}`}>
                            {stockLabel}
                        </span>
                        <div className={styles.actions}>
                            <QuantityStepper
                                value={quantity}
                                min={1}
                                max={stockValue ?? undefined}
                                onChange={setQuantity}
                                compact
                                disabled={pending || isOutOfStock}
                            />
                            <button
                                type="button"
                                className={styles.addButton}
                                onClick={() => onAdd?.({ quantity, variantId: activeVariant?.id })}
                                disabled={pending || isOutOfStock}
                            >
                                {pending ? 'Adding…' : 'Add'}
                            </button>
                        </div>
                        <span className={styles.trustCue}>Pesticide-free</span>
                        {showMaxNotice ? (
                            <span className={styles.maxNotice}>Max available: {stockValue}</span>
                        ) : null}
                    </div>

                    <footer className={styles.footer}>
                        <Link
                            to={`/store/product/${encodeURIComponent(id)}`}
                            className={styles.link}
                            aria-label={`View details for ${title}`}
                        >
                            View details →
                        </Link>
                    </footer>
                </div>
            </div>

        </article>
    );
}
