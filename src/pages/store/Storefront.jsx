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
    const [availability, setAvailability] = useState('all');
    const [tagFilter, setTagFilter] = useState('all');

    const sortedProducts = useMemo(() => {
        const list = Array.isArray(products) ? [...products] : [];
        if (sortBy === 'price') {
            return list.sort((a, b) => (a?.price ?? 0) - (b?.price ?? 0));
        }
        return list.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
    }, [products, sortBy]);

    const tags = useMemo(() => {
        const tagSet = new Set();
        sortedProducts.forEach((product) => {
            (product?.tags || []).forEach((tag) => tagSet.add(tag));
        });
        return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    }, [sortedProducts]);

    const filteredProducts = useMemo(() => {
        return sortedProducts.filter((product) => {
            const isInStock = product?.stock === undefined || product.stock > 0;
            const availabilityMatches =
                availability === 'all'
                    || (availability === 'inStock' && isInStock)
                    || (availability === 'outOfStock' && !isInStock);
            const tagMatches = tagFilter === 'all' || (product?.tags || []).includes(tagFilter);
            return availabilityMatches && tagMatches;
        });
    }, [availability, sortedProducts, tagFilter]);

    const showSort = (products?.length ?? 0) > 1;

    const inStock = useMemo(
        () => filteredProducts.filter((product) => product.stock === undefined || product.stock > 0),
        [filteredProducts],
    );
    const lowStock = useMemo(
        () => filteredProducts.filter((product) => product.stock !== undefined && product.stock <= 0),
        [filteredProducts],
    );

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
                        <div className={styles.filters}>
                            <div className={styles.field}>
                                <label htmlFor="availability">Availability</label>
                                <select
                                    id="availability"
                                    value={availability}
                                    onChange={(event) => setAvailability(event.target.value)}
                                >
                                    <option value="all">All</option>
                                    <option value="inStock">In stock</option>
                                    <option value="outOfStock">Out of stock</option>
                                </select>
                            </div>
                            {tags.length > 0 ? (
                                <div className={styles.field}>
                                    <label htmlFor="tag">Tag</label>
                                    <select id="tag" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                                        <option value="all">All</option>
                                        {tags.map((tag) => (
                                            <option key={tag} value={tag}>{tag}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : null}
                            {showSort ? (
                                <div className={styles.field}>
                                    <label htmlFor="sort">Sort</label>
                                    <select id="sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                                        <option value="name">Name</option>
                                        <option value="price">Price</option>
                                    </select>
                                </div>
                            ) : null}
                        </div>
                        <p className={styles.sectionNote}>Prices shown in SEK · Stock updates after each add</p>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loading}>Loading products…</div>
                ) : inStock.length > 0 ? (
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
                ) : (
                    <div className={styles.emptyState}>No products match your filters.</div>
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
