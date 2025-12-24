import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchStoreProduct } from '../../api/store.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import QuantityStepper from '../../components/store/QuantityStepper.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import { getPriceContext, getProductFacts } from '../../utils/productCopy.js';
import styles from './ProductDetail.module.css';

export default function ProductDetail() {
    const { productId } = useParams();
    const navigate = useNavigate();
    const { addToCart, pendingProductId } = useStorefront();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [quantity, setQuantity] = useState(1);

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
    }, [productId]);

    const isOutOfStock = product?.stock !== undefined && product?.stock <= 0;
    const currency = product?.currency || 'SEK';
    const priceLabel = formatCurrency(product?.price ?? 0, currency);
    const priceContext = getPriceContext(product);
    const productFacts = getProductFacts(product);

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
                        {product?.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} />
                        ) : (
                            <div className={styles.placeholder} aria-hidden="true" />
                        )}
                    </div>

                    <div className={styles.panel}>
                        <p className={styles.kicker}>In the HydroLeaf store</p>
                        <h1 className={styles.title}>{product?.name}</h1>
                        <p className={styles.subtitle}>Product details</p>
                        <div className={styles.priceBlock}>
                            <span className={styles.price}>{priceLabel}</span>
                            <span className={styles.currency}>{currencyLabel(currency)}</span>
                            <span className={styles.priceMeta}>{priceContext}</span>
                            {product?.stock !== undefined && (
                                <span className={`${styles.badge} ${isOutOfStock ? styles.badgeMuted : styles.badgePositive}`}>
                                    {isOutOfStock ? 'Out of stock' : `${product.stock} in stock`}
                                </span>
                            )}
                        </div>

                        <ul className={styles.list}>
                            {productFacts.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>

                        <div className={styles.actions}>
                            <QuantityStepper
                                value={quantity}
                                min={1}
                                max={product?.stock || undefined}
                                onChange={setQuantity}
                                disabled={pendingProductId === productId || isOutOfStock}
                            />
                            <button
                                type="button"
                                className={styles.add}
                                disabled={pendingProductId === productId || isOutOfStock}
                                onClick={() => addToCart(product.id, quantity)}
                            >
                                {pendingProductId === productId ? 'Adding…' : 'Add to cart'}
                            </button>
                        </div>
                        <p className={styles.meta}>Shipping estimates and totals update after each cart change.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
