import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStoreProducts } from '../api/store.js';
import { formatCurrency } from '../utils/currency.js';
import styles from './Home.module.css';

export default function Home() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const featuredProducts = useMemo(() => {
        const list = Array.isArray(products) ? products : [];
        const available = list.filter((product) => product?.stock === undefined || product.stock > 0);
        const source = available.length > 0 ? available : list;
        return source.slice(0, 4);
    }, [products]);

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await listStoreProducts();
            const list = response?.products ?? response ?? [];
            setProducts(Array.isArray(list) ? list : []);
        } catch (err) {
            setError(err?.message || 'Unable to load featured products.');
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
                <div className={styles.heroContent}>
                    <p className={styles.kicker}>HydroLeaf Storefront</p>
                    <h1 className={styles.title}>Grow smarter with curated hydroponic essentials.</h1>
                    <p className={styles.subtitle}>
                        From sensors to nutrient kits, we make it easy to build a reliable grow setup that
                        stays efficient, clean, and production-ready.
                    </p>
                    <div className={styles.heroActions}>
                        <Link to="/store" className={styles.ctaPrimary}>Shop the store</Link>
                        <Link to="/about" className={styles.ctaSecondary}>Why HydroLeaf</Link>
                    </div>
                </div>
                <div className={styles.heroCard}>
                    <h2>Designed for growers</h2>
                    <ul>
                        <li>Handpicked inventory with verified specs.</li>
                        <li>Fast checkout and local fulfillment.</li>
                        <li>Support from a team that grows with you.</li>
                    </ul>
                </div>
            </section>

            <section className={styles.whySection}>
                <div>
                    <p className={styles.sectionKicker}>Why HydroLeaf</p>
                    <h2>Everything you need to stay consistent.</h2>
                </div>
                <div className={styles.whyGrid}>
                    <article>
                        <h3>Reliable supply</h3>
                        <p>Our team keeps core items stocked so you can plan harvests with confidence.</p>
                    </article>
                    <article>
                        <h3>Transparent pricing</h3>
                        <p>Clear product specs, helpful context, and no surprises at checkout.</p>
                    </article>
                    <article>
                        <h3>Grower support</h3>
                        <p>Need guidance? We&apos;re here with practical insights from real setups.</p>
                    </article>
                </div>
            </section>

            <section className={styles.featuredSection}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.sectionKicker}>Featured products</p>
                        <h2>Popular picks this week</h2>
                    </div>
                    <Link to="/store" className={styles.sectionLink}>View all products</Link>
                </div>
                {error && (
                    <div className={styles.alert} role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={fetchProducts}>Retry</button>
                    </div>
                )}
                {loading ? (
                    <p className={styles.loading}>Loading featured products…</p>
                ) : (
                    <div className={styles.featuredGrid}>
                        {featuredProducts.map((product) => (
                            <article key={product.id} className={styles.featuredCard}>
                                <div className={styles.cardMedia}>
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} />
                                    ) : (
                                        <div className={styles.cardPlaceholder} aria-hidden="true" />
                                    )}
                                </div>
                                <div className={styles.cardBody}>
                                    <h3>{product.name}</h3>
                                    <p>{product.shortDescription || product.description}</p>
                                    <div className={styles.cardFooter}>
                                        <span>{formatCurrency(product.price, product.currency || 'SEK')}</span>
                                        <Link to={`/store/product/${encodeURIComponent(product.id)}`}>
                                            View details
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
