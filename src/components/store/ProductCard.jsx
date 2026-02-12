import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QuantityStepper from './QuantityStepper.jsx';
import { formatCurrency } from '../../utils/currency.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractUserPricingTier, hasTierPriceDiscount, resolveTierPrice } from '../../utils/pricingTier.js';
import {
    getActiveVariants,
    getDefaultVariantId,
    getVariantLabel,
    getVariantPrice,
    getVariantStock,
    isVariantInStock,
} from '../../utils/storeVariants.js';
import styles from './ProductCard.module.css';
import placeholderImage from '../../assets/hydroleaf_logo.png';

const getFirstGalleryImage = (images) => {
    if (!Array.isArray(images) || images.length === 0) return '';
    const first = images[0];
    if (!first) return '';
    if (typeof first === 'string') return first;
    return first.url ?? first.imageUrl ?? first.src ?? '';
};

export default function ProductCard({ product, onAdd, pending = false, layout = 'grid' }) {
    const { profile } = useAuth();
    const [quantity, setQuantity] = useState(1);
    const navigate = useNavigate();
    const variants = useMemo(() => getActiveVariants(product), [product]);
    const defaultVariantId = useMemo(() => getDefaultVariantId(variants), [variants]);
    const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
    const [selectedVariant, setSelectedVariant] = useState(null);

    const { name, id, currency } = product || {};
    const activeVariant = selectedVariant;
    const pricingTier = extractUserPricingTier(profile);
    const priceValue = getVariantPrice(selectedVariant, pricingTier) ?? resolveTierPrice(product, pricingTier) ?? product?.price ?? 0;
    const defaultPriceValue = getVariantPrice(selectedVariant, 'DEFAULT') ?? resolveTierPrice(product, 'DEFAULT') ?? product?.price ?? 0;
    const hasTierDiscount = hasTierPriceDiscount(selectedVariant ?? product, pricingTier);
    const stockValue = selectedVariant ? getVariantStock(selectedVariant) : product?.stock;
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
        setSelectedVariant(variants.find((variant) => variant.id === selectedVariantId) ?? variants[0] ?? null);
    }, [selectedVariantId, variants]);

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
    const detailHref = id ? `/store/product/${encodeURIComponent(id)}` : null;
    const variantImageUrl = selectedVariant?.imageUrl ?? selectedVariant?.image?.url;
    const thumbnailUrl = product?.thumbnailUrl ?? product?.primaryImageUrl;
    const galleryImageUrl = getFirstGalleryImage(product?.images);
    const resolvedImage = variantImageUrl || thumbnailUrl || galleryImageUrl || placeholderImage;
    const imageSourceField = variantImageUrl
        ? 'selectedVariant.imageUrl'
        : thumbnailUrl
            ? (product?.thumbnailUrl ? 'product.thumbnailUrl' : 'product.primaryImageUrl')
            : galleryImageUrl
                ? 'product.images[0].url'
                : 'placeholderImage';

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        console.debug('[Store/ProductCard] image source resolved', {
            productId: id,
            selectedVariantId,
            imageSourceField,
            resolvedImage,
        });
    }, [id, imageSourceField, resolvedImage, selectedVariantId]);

    const handleCardNavigate = (event) => {
        if (!detailHref) return;
        if (event.defaultPrevented) return;
        const interactive = event.target.closest('a, button, input, select, textarea, [role="button"]');
        if (interactive && interactive !== event.currentTarget) return;
        navigate(detailHref);
    };

    const handleCardKeyDown = (event) => {
        if (!detailHref) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        navigate(detailHref);
    };

    return (
        <article
            className={`${styles.card} ${detailHref ? styles.cardClickable : ''} ${layout === 'single' ? styles.cardSingle : ''}`}
            onClick={handleCardNavigate}
            onKeyDown={handleCardKeyDown}
            role={detailHref ? 'button' : undefined}
            tabIndex={detailHref ? 0 : undefined}
            aria-label={detailHref ? `View details for ${title}` : undefined}
        >
            <div className={styles.media}>
                <img src={resolvedImage} alt={name} data-image-source={imageSourceField} loading="lazy" />
                {import.meta.env.DEV ? (
                    <span className={styles.imageDebug} aria-label={`Image source: ${imageSourceField}`}>
                        {imageSourceField}
                    </span>
                ) : null}
            </div>

            <div className={styles.body}>
                <div className={styles.headerRow}>
                    <div>
                        <h3 className={styles.name}>{title}</h3>
                        {badge ? <span className={styles.badge}>{badge}</span> : null}
                    </div>
                    <div className={styles.price}>
                        {hasTierDiscount ? <span className={styles.originalPrice}>{formatCurrency(defaultPriceValue, currency || 'SEK')}</span> : null}
                        <span className={styles.priceValue}>{priceLabel}</span>
                        {hasTierDiscount ? <span className={styles.supporterTag}>Supporter price</span> : null}
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
                        {detailHref ? (
                            <Link
                                to={detailHref}
                                className={styles.link}
                                aria-label={`View details for ${title}`}
                            >
                                View details →
                            </Link>
                        ) : null}
                    </footer>
                </div>
            </div>

        </article>
    );
}
