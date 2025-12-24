import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStoreProducts } from '../../api/store.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import ProductCard from '../../components/store/ProductCard.jsx';
import styles from './Storefront.module.css';

export default function Storefront() {
    const { addToCart, pendingProductId, cart } = useStorefront();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('name');

    const sortedProducts = useMemo(() => {
        const list = Array.isArray(products) ? [...products] : [];
        if (sortBy === 'price') {
            return list.sort((a, b) => (a?.price ?? 0) - (b?.price ?? 0));
        }
        return list.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
    }, [products, sortBy]);

    const itemCount = useMemo(() => cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0, [cart]);
    const hasItems = itemCount > 0;

    const inStock = useMemo(() => sortedProducts.filter((product) => product.stock === undefined || product.stock > 0), [sortedProducts]);
    const lowStock = useMemo(() => sortedProducts.filter((product) => product.stock !== undefined && product.stock <= 0), [sortedProducts]);

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await listStoreProducts();
            const list = response?.products ?? response ?? [];
            setProducts(Array.isArray(list) ? list : []);
        } catch (err) {
            setError(err?.message || 'Unable to load products.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroCopy}>
                    <p className={styles.kicker}>HydroLeaf Store</p>
                    <h1 className={styles.title}>Fresh basil &amp; packaging</h1>
                    <p className={styles.valueProp}>
                        Order greenhouse basil, clean packaging, and hydroponic gear in SEK with calm, food-grade handling.
                    </p>
                    <div className={styles.pills}>
                        <span>Grown in Sweden</span>
                        <span>Food-grade handling</span>
                        <span>Fast pickup</span>
                    </div>
                </div>
                <div className={styles.heroCard}>
                    <p className={styles.heroLabel}>Simple checkout</p>
                    <h3>Built for busy kitchens</h3>
                    <p className={styles.heroText}>
                        Keep your cart open while you browse. Prices stay in SEK and update as quantities change.
                    </p>
                    {hasItems ? (
                        <Link to="/store/checkout" className={styles.heroAction}>
                            Checkout
                        </Link>
                    ) : (
                        <a href="#products" className={styles.heroAction}>
                            Start shopping
                        </a>
                    )}
                </div>
            </section>

            {error && (
                <div className={styles.alert} role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={fetchProducts}>Retry</button>
                </div>
            )}

            <section className={styles.section} id="products">
                <div className={styles.sectionHead}>
                    <div>
                        <p className={styles.sectionKicker}>Available now</p>
                        <h2>Products in stock</h2>
                    </div>
                    <div className={styles.controls}>
                        <div className={styles.field}>
                            <label htmlFor="sort">Sort</label>
                            <select id="sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                                <option value="name">Name</option>
                                <option value="price">Price</option>
                            </select>
                        </div>
                        <p className={styles.sectionNote}>Prices shown in SEK · Stock updates after each add</p>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loading}>Loading products…</div>
                ) : (
                    <div className={styles.grid}>
                        {inStock.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                pending={pendingProductId === product.id}
                                onAdd={(qty) => addToCart(product.id, qty)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {lowStock.length > 0 && (
                <section className={styles.section}>
                    <div className={styles.sectionHead}>
                        <div>
                            <p className={styles.sectionKicker}>Restocking</p>
                            <h2>More items on the way</h2>
                        </div>
                        <p className={styles.sectionNote}>We&apos;ll make these available again shortly.</p>
                    </div>
                    <div className={styles.grid}>
                        {lowStock.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                pending={pendingProductId === product.id}
                                onAdd={(qty) => addToCart(product.id, qty)}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
