import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchStoreProduct } from '../../api/store.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePricingDisplay } from '../../context/PricingDisplayContext.jsx';
import QuantityStepper from '../../components/store/QuantityStepper.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import { getPriceContext, getProductFacts } from '../../utils/productCopy.js';
import { extractUserPricingTier, resolveTierPricingDisplay } from '../../utils/pricingTier.js';
import { displayPrice, getPriceDisplaySuffix } from '../../utils/storePricingDisplay.js';
import {
    getActiveVariants,
    getDefaultVariantId,
    getVariantLabel,
    getVariantStock,
    isVariantInStock,
} from '../../utils/storeVariants.js';
import styles from './ProductDetail.module.css';

export default function ProductDetail() {
    const { productId } = useParams();
    const navigate = useNavigate();
    const { addToCart, pendingProductId } = useStorefront();
    const { profile, isAuthenticated } = useAuth();
    const { priceDisplayMode, vatRate } = usePricingDisplay();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const variants = useMemo(() => getActiveVariants(product), [product]);
    const defaultVariantId = useMemo(() => getDefaultVariantId(variants), [variants]);
    const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    useEffect(() => {
        let mounted = true;
        const fetchProduct = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetchStoreProduct(productId);
                if (!mounted) return;
                setProduct(response?.product ?? response);
            } catch (err) {
                if (!mounted) return;
                setError(err?.message || 'Unable to load product.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchProduct();
        return () => {
            mounted = false;
        };
    }, [isAuthenticated, productId]);

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

    const stockValue = selectedVariant ? getVariantStock(selectedVariant) : product?.stock;
    const isOutOfStock = stockValue !== undefined && stockValue <= 0;
    const currency = product?.currency || selectedVariant?.currency || 'SEK';
    const pricingTier = extractUserPricingTier(profile);
    const pricingDisplay = resolveTierPricingDisplay({ variant: selectedVariant, product, tier: pricingTier });
    const regularGrossPrice = pricingDisplay.defaultCents !== null ? pricingDisplay.defaultCents / 100 : (product?.price ?? 0);
    const grossPriceValue = pricingDisplay.effectiveCents !== null ? pricingDisplay.effectiveCents / 100 : regularGrossPrice;
    const regularPrice = displayPrice(regularGrossPrice, vatRate, priceDisplayMode);
    const priceValue = displayPrice(grossPriceValue, vatRate, priceDisplayMode);
    const appliedTier = pricingDisplay.appliedTier;
    const tierPriceApplied = pricingDisplay.showTierPrice;
    const priceLabel = formatCurrency(priceValue, currency);
    const priceContext = getPriceContext(selectedVariant ?? product);
    const priceModeSuffix = getPriceDisplaySuffix(priceDisplayMode);
    const productFacts = getProductFacts(selectedVariant ?? product);
    const tierLabel = useMemo(() => {
        const labels = {
            VIP: 'VIP price',
            SUPPORTER: 'Supporter price',
            B2B: 'B2B price',
        };
        return labels[appliedTier] ?? '';
    }, [appliedTier]);
    const showVariantSelector = variants.length > 1;
    const useDropdown = variants.length > 4;
    const imageSrc = selectedVariant?.imageUrl ?? product?.imageUrl;

    useEffect(() => {
        if (stockValue !== undefined && stockValue > 0 && quantity > stockValue) {
            setQuantity(stockValue);
        }
        if (stockValue !== undefined && stockValue <= 0) {
            setQuantity(1);
        }
    }, [quantity, stockValue]);

    useEffect(() => {
        if (!isImageModalOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsImageModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isImageModalOpen]);

    return (
        <div className={styles.page}>
            <div className={styles.breadcrumbs}>
                <Link to="/store">Products</Link>
                <span>/</span>
                <span className={styles.current}>{product?.name ?? 'Loading…'}</span>
            </div>

            {loading ? (
                <div className={styles.loading}>Loading product…</div>
            ) : error ? (
                <div className={styles.error}>
                    <p>{error}</p>
                    <button type="button" onClick={() => navigate('/store')}>Back to products</button>
                </div>
            ) : (
                <div className={styles.layout}>
                    <div className={styles.media}>
                        {imageSrc ? (
                            <button
                                type="button"
                                className={styles.imageButton}
                                onClick={() => setIsImageModalOpen(true)}
                                aria-label="Open product image"
                            >
                                <img
                                    src={imageSrc}
                                    alt={product.name}
                                    onError={(event) => {
                                        if (product?.imageUrl && event.currentTarget.src !== product.imageUrl) {
                                            event.currentTarget.src = product.imageUrl;
                                        }
                                    }}
                                />
                            </button>
                        ) : (
                            <div className={styles.placeholder} aria-hidden="true" />
                        )}
                    </div>

                    <div className={styles.panel}>
                        <Link to="/store" className={styles.backLink}>← Back to store</Link>
                        <p className={styles.kicker}>In the HydroLeaf store</p>
                        <h1 className={styles.title}>{product?.name}</h1>
                        <p className={styles.subtitle}>Product details</p>
                        <div className={styles.priceBlock}>
                            <div className={styles.priceWrap}>
                                {tierPriceApplied ? <span className={styles.priceOldInvalid}>{formatCurrency(regularPrice, currency)}</span> : null}
                                <span className={`${styles.price} ${tierPriceApplied ? styles.priceNewValid : ''}`}>{priceLabel}</span>
                                <span className={styles.currency}>{currencyLabel(currency)}</span>
                                {tierPriceApplied && tierLabel ? <span className={styles.tierBadge}>{tierLabel}</span> : null}
                            </div>
                            <span className={styles.priceMeta}>{tierPriceApplied ? tierLabel : `${priceContext} · ${priceModeSuffix}`}</span>
                            {stockValue !== undefined && (
                                <span className={`${styles.badge} ${isOutOfStock ? styles.badgeMuted : styles.badgePositive}`}>
                                    {isOutOfStock ? 'Out of stock' : `${stockValue} in stock`}
                                </span>
                            )}
                        </div>

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

                        <ul className={styles.list}>
                            {productFacts.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>

                        <div className={styles.actions}>
                            <QuantityStepper
                                value={quantity}
                                min={1}
                                max={stockValue ?? undefined}
                                onChange={setQuantity}
                                disabled={pendingProductId === productId || isOutOfStock}
                            />
                            <button
                                type="button"
                                className={styles.add}
                                disabled={pendingProductId === productId || isOutOfStock}
                                onClick={() => addToCart(selectedVariant?.id, quantity, product.id)}
                            >
                                {pendingProductId === productId ? 'Adding…' : 'Add to cart'}
                            </button>
                        </div>
                        <p className={styles.meta}>Shipping estimates and totals update after each cart change.</p>
                    </div>
                </div>
            )}

            {isImageModalOpen && imageSrc ? (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Product image preview" onClick={() => setIsImageModalOpen(false)}>
                    <button
                        type="button"
                        className={styles.modalClose}
                        onClick={() => setIsImageModalOpen(false)}
                        aria-label="Close image preview"
                    >
                        ×
                    </button>
                    <img
                        className={styles.modalImage}
                        src={imageSrc}
                        alt={product?.name}
                        onClick={(event) => event.stopPropagation()}
                    />
                </div>
            ) : null}
        </div>
    );
}
