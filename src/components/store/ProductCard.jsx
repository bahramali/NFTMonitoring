import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import QuantityStepper from './QuantityStepper.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, onAdd, pending = false }) {
    const [quantity, setQuantity] = useState(1);

    const { name, id, imageUrl, shortDescription, price, currency, stock, badges = [], tags = [] } = product || {};
    const isOutOfStock = stock !== undefined && stock <= 0;
    const priceLabel = useMemo(() => formatCurrency(price, currency || 'SEK'), [currency, price]);

    return (
        <article className={styles.card}>
            <div className={styles.media}>
                {imageUrl ? (
                    <img src={imageUrl} alt={name} />
                ) : (
                    <div className={styles.placeholder} aria-hidden="true">
                        <span className={styles.logoDot} />
                    </div>
                )}
                <div className={styles.badges}>
                    {isOutOfStock ? <span className={`${styles.badge} ${styles.badgeMuted}`}>Out of stock</span> : null}
                    {stock > 0 ? <span className={`${styles.badge} ${styles.badgePositive}`}>{stock} in stock</span> : null}
                    {badges.map((badge) => (
                        <span key={badge} className={styles.badge}>{badge}</span>
                    ))}
                </div>
            </div>

            <div className={styles.body}>
                <div className={styles.titleRow}>
                    <div>
                        <h3 className={styles.name}>{name}</h3>
                        <p className={styles.description}>{shortDescription || product?.description}</p>
                    </div>
                    <div className={styles.price}>
                        <span className={styles.priceValue}>{priceLabel}</span>
                        <span className={styles.priceCurrency}>{currencyLabel(currency || 'SEK')}</span>
                    </div>
                </div>

                {tags.length > 0 && (
                    <div className={styles.tagRow}>
                        {tags.map((tag) => (
                            <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                    </div>
                )}

                <div className={styles.actions}>
                    <QuantityStepper
                        value={quantity}
                        min={1}
                        max={stock || undefined}
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
                        {pending ? 'Adding…' : 'Add to cart'}
                    </button>
                </div>
            </div>

            <footer className={styles.footer}>
                <Link to={`/store/product/${encodeURIComponent(id)}`} className={styles.link}>View details</Link>
                <span className={styles.secondary}>{currencyLabel(currency || 'SEK')}</span>
            </footer>
        </article>
    );
}
