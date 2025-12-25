import React, { useEffect, useMemo, useState } from 'react';
import { listStoreProducts } from '../../api/store.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import ProductCard from '../../components/store/ProductCard.jsx';
import styles from './Storefront.module.css';

export default function Storefront() {
    const { addToCart, pendingProductId } = useStorefront();
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

    const showSort = (products?.length ?? 0) > 1;

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
            <header className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Store</h1>
            </header>

            <section className={styles.hero}>
                <div className={styles.heroCopy}>
                    <p className={styles.kicker}>HydroLeaf Store</p>
                    <h2 className={styles.title}>Fresh basil for home cooking and busy kitchens</h2>
                    <p className={styles.valueProp}>
                        Handled in a clean, controlled environment from harvest to pickup.
                    </p>
                    <div className={styles.pills}>
                        <span>Grown in Sweden</span>
                        <span>Fresh handling</span>
                        <span>Pickup-ready</span>
                    </div>
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
                        {showSort ? (
                            <div className={styles.field}>
                                <label htmlFor="sort">Sort</label>
                                <select id="sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                                    <option value="name">Name</option>
                                    <option value="price">Price</option>
                                </select>
                            </div>
                        ) : null}
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
