import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QuantityStepper from './QuantityStepper.jsx';
import { formatCurrency } from '../../utils/currency.js';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, onAdd, pending = false, layout = 'grid' }) {
    const [quantity, setQuantity] = useState(1);

    const { name, id, imageUrl, price, currency, stock } = product || {};
    const isOutOfStock = stock !== undefined && stock <= 0;
    const stockLabel = useMemo(() => {
        if (stock === undefined) return 'In stock';
        if (stock <= 0) return 'Out of stock';
        if (stock <= 10) return `Only ${stock} left`;
        return 'In stock';
    }, [stock]);
    const priceLabel = useMemo(() => formatCurrency(price, currency || 'SEK'), [currency, price]);

    const { title, badge } = useMemo(() => {
        const safeName = name ? String(name).trim() : '';
        if (!safeName) return { title: '', badge: '' };
        const parts = safeName.split(/\s*[–-]\s*/);
        if (parts.length <= 1) return { title: safeName, badge: '' };
        const [first, ...rest] = parts;
        return { title: first.trim(), badge: rest.join(' - ').trim() };
    }, [name]);

    useEffect(() => {
        if (stock !== undefined && stock > 0 && quantity > stock) {
            setQuantity(stock);
        }
        if (stock !== undefined && stock <= 0) {
            setQuantity(1);
        }
    }, [quantity, stock]);

    const showMaxNotice = stock !== undefined && stock > 0 && quantity >= stock;

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

                <div className={styles.buySection}>
                    <span className={`${styles.stock} ${isOutOfStock ? styles.stockMuted : ''}`}>
                        {stockLabel}
                    </span>
                    <div className={styles.actions}>
                        <QuantityStepper
                            value={quantity}
                            min={1}
                            max={stock ?? undefined}
                            onChange={setQuantity}
                            compact
                            disabled={pending || isOutOfStock}
                        />
                        <button
                            type="button"
                            className={styles.addButton}
                            onClick={() => onAdd?.(quantity)}
                            disabled={pending || isOutOfStock}
                        >
                            {pending ? 'Adding…' : 'Add'}
                        </button>
                    </div>
                    <span className={styles.trustCue}>Pesticide-free</span>
                    {showMaxNotice ? (
                        <span className={styles.maxNotice}>Max available: {stock}</span>
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

        </article>
    );
}
