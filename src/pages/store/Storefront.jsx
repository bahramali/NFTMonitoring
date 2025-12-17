import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStoreProducts } from '../../api/store.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import ProductCard from '../../components/store/ProductCard.jsx';
import styles from './Storefront.module.css';

export default function Storefront() {
    const { addToCart, pendingProductId } = useStorefront();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const inStock = useMemo(() => products.filter((product) => product.stock === undefined || product.stock > 0), [products]);
    const lowStock = useMemo(() => products.filter((product) => product.stock !== undefined && product.stock <= 0), [products]);

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
                    <p className={styles.kicker}>HydroLeaf Public Store</p>
                    <h1 className={styles.title}>Fresh basil, packaging, and hydroponic gear</h1>
                    <p className={styles.subtitle}>
                        Browse live inventory, add items to your cart, and check out securely. All prices are shown in SEK.
                    </p>
                    <div className={styles.pills}>
                        <span>Real-time stock</span>
                        <span>SEK pricing</span>
                        <span>Fast checkout</span>
                    </div>
                </div>
                <div className={styles.heroCard}>
                    <p className={styles.heroLabel}>Order guidance</p>
                    <h3>Need help choosing gear?</h3>
                    <p className={styles.heroText}>
                        We&apos;ll align packaging, basil volumes, and hydroponic kits based on your channel. Start with any product and adjust quantities later.
                    </p>
                    <Link to="/store/checkout" className={styles.heroAction}>
                        Go to checkout
                    </Link>
                </div>
            </section>

            {error && (
                <div className={styles.banner}>
                    <p>{error}</p>
                    <button type="button" onClick={fetchProducts}>Retry</button>
                </div>
            )}

            <section className={styles.section}>
                <div className={styles.sectionHead}>
                    <div>
                        <p className={styles.sectionKicker}>Available now</p>
                        <h2>Products in stock</h2>
                    </div>
                    <p className={styles.sectionNote}>Select quantity and add to cart. Stock updates after each action.</p>
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
                            <p className={styles.sectionKicker}>Out of stock</p>
                            <h2>We&apos;ll restock these shortly</h2>
                        </div>
                        <p className={styles.sectionNote}>Add them to your list and we&apos;ll notify you once available.</p>
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
