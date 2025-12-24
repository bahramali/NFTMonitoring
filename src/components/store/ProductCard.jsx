import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QuantityStepper from './QuantityStepper.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import { getPriceContext } from '../../utils/productCopy.js';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, onAdd, pending = false }) {
    const [quantity, setQuantity] = useState(1);
    const [showSticky, setShowSticky] = useState(false);
    const [isCtaVisible, setIsCtaVisible] = useState(true);
    const [isCardVisible, setIsCardVisible] = useState(false);
    const ctaRef = useRef(null);
    const cardRef = useRef(null);

    const { name, id, imageUrl, shortDescription, price, currency, stock, badges = [], tags = [] } = product || {};
    const isOutOfStock = stock !== undefined && stock <= 0;
    const stockLabel = useMemo(() => {
        if (stock === undefined) return 'In stock';
        if (stock <= 0) return 'Out of stock';
        if (stock <= 5) return 'Low stock';
        return 'In stock';
    }, [stock]);
    const priceLabel = useMemo(() => formatCurrency(price, currency || 'SEK'), [currency, price]);
    const priceContext = useMemo(() => getPriceContext(product), [product]);

    useEffect(() => {
        if (!ctaRef.current || !cardRef.current) return undefined;

        const ctaObserver = new IntersectionObserver(
            ([entry]) => {
                setIsCtaVisible(entry.isIntersecting);
            },
            { threshold: 0.6 }
        );

        const cardObserver = new IntersectionObserver(
            ([entry]) => {
                setIsCardVisible(entry.isIntersecting);
            },
            { threshold: 0.1 }
        );

        ctaObserver.observe(ctaRef.current);
        cardObserver.observe(cardRef.current);

        return () => {
            ctaObserver.disconnect();
            cardObserver.disconnect();
        };
    }, []);

    useEffect(() => {
        setShowSticky(isCardVisible && !isCtaVisible);
    }, [isCardVisible, isCtaVisible]);

    return (
        <article ref={cardRef} className={styles.card}>
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
                <div className={styles.titleRow}>
                    <div>
                        <h3 className={styles.name}>{name}</h3>
                        <p className={styles.description}>{shortDescription || product?.description}</p>
                    </div>
                    <div className={styles.price}>
                        <span className={styles.priceValue}>{priceLabel}</span>
                        <span className={styles.priceCurrency}>{currencyLabel(currency || 'SEK')}</span>
                        <span className={styles.priceMeta}>{priceContext}</span>
                    </div>
                </div>

                {(tags.length > 0 || badges.length > 0) && (
                    <div className={styles.tagRow}>
                        {[...badges, ...tags].map((tag) => (
                            <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                    </div>
                )}

                <div className={styles.metaRow}>
                    <span className={`${styles.stock} ${isOutOfStock ? styles.stockMuted : ''}`}>
                        {stockLabel}
                        {stock > 0 ? ` · ${stock} pcs` : ''}
                    </span>
                    <span className={styles.unitLabel}>{currencyLabel(currency || 'SEK')}</span>
                </div>

                <div ref={ctaRef} className={styles.actions}>
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
                        {pending ? 'Adding…' : 'Add'}
                    </button>
                </div>

                <footer className={styles.footer}>
                    <Link to={`/store/product/${encodeURIComponent(id)}`} className={styles.link}>View details</Link>
                    <span className={styles.secondary}>{currencyLabel(currency || 'SEK')}</span>
                </footer>
            </div>

            <div className={`${styles.stickyBar} ${showSticky ? styles.stickyBarVisible : ''}`}>
                <div className={styles.stickySummary}>
                    <span className={styles.stickyName}>{name}</span>
                    <span className={styles.stickyPrice}>{priceLabel}</span>
                </div>
                <div className={styles.stickyActions}>
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
                        className={`${styles.addButton} ${styles.stickyAddButton}`}
                        onClick={() => onAdd?.(quantity)}
                        disabled={pending || isOutOfStock}
                    >
                        {pending ? 'Adding…' : 'Add'}
                    </button>
                </div>
            </div>
        </article>
    );
}
