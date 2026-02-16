import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStoreBanners, listStoreProducts } from '../../api/store.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import ProductCard from '../../components/store/ProductCard.jsx';
import StoreHeroBanner from '../../components/store/StoreHeroBanner.jsx';
import StoreBannerRow from '../../components/store/StoreBannerRow.jsx';
import { getProductSortPrice, isProductInStock } from '../../utils/storeVariants.js';
import { usePricingDisplay } from '../../context/PricingDisplayContext.jsx';
import { getPriceDisplaySuffix } from '../../utils/storePricingDisplay.js';
import styles from './Storefront.module.css';

const normalizeBanners = (payload) => {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.banners)
            ? payload.banners
            : [];

    return list
        .map((banner) => ({
            ...banner,
            id: banner?.id ?? banner?.bannerId ?? banner?._id ?? '',
            type: String(banner?.type ?? 'PROMO').toUpperCase(),
            active: banner?.active !== false,
            position: Number.isFinite(Number(banner?.position)) ? Number(banner.position) : 0,
        }))
        .filter((banner) => banner.active)
        .sort((a, b) => a.position - b.position);
};

export default function Storefront() {
    const { addToCart, pendingProductId } = useStorefront();
    const { priceDisplayMode } = usePricingDisplay();
    const { isAuthenticated, isBootstrapping } = useAuth();
    const [products, setProducts] = useState([]);
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [availability, setAvailability] = useState('all');
    const [tagFilter, setTagFilter] = useState('all');

    const heroBanner = useMemo(
        () => banners.find((banner) => banner.type === 'HERO') || null,
        [banners],
    );

    const secondaryBanners = useMemo(
        () => banners.filter((banner) => banner.type !== 'HERO'),
        [banners],
    );

    const sortedProducts = useMemo(() => {
        const list = Array.isArray(products) ? [...products] : [];
        if (sortBy === 'price') {
            return list.sort((a, b) => getProductSortPrice(a) - getProductSortPrice(b));
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
            const isInStock = isProductInStock(product);
            const availabilityMatches =
                availability === 'all'
                    || (availability === 'inStock' && isInStock)
                    || (availability === 'outOfStock' && !isInStock);
            const tagMatches = tagFilter === 'all' || (product?.tags || []).includes(tagFilter);
            return availabilityMatches && tagMatches;
        });
    }, [availability, sortedProducts, tagFilter]);

    const productCount = products?.length ?? 0;
    const isSingleProduct = productCount === 1;
    const showSort = productCount > 1;
    const showAvailability = productCount >= 3;

    const inStock = useMemo(
        () => filteredProducts.filter((product) => isProductInStock(product)),
        [filteredProducts],
    );
    const outOfStock = useMemo(
        () => filteredProducts.filter((product) => !isProductInStock(product)),
        [filteredProducts],
    );

    const fetchStoreData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [productsResponse, bannersResponse] = await Promise.all([
                listStoreProducts(),
                listStoreBanners(),
            ]);
            const list = productsResponse?.products ?? productsResponse ?? [];
            setProducts(Array.isArray(list) ? list : []);
            setBanners(normalizeBanners(bannersResponse));
        } catch (err) {
            setError(err?.message || 'Unable to load store data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isBootstrapping) {
            return;
        }

        fetchStoreData();
    }, [isAuthenticated, isBootstrapping]);

    return (
        <div className={styles.page}>
            {heroBanner ? <StoreHeroBanner banner={heroBanner} /> : null}
            {secondaryBanners.length > 0 ? <StoreBannerRow banners={secondaryBanners} /> : null}

            {error && (
                <div className={styles.alert} role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={fetchStoreData}>Retry</button>
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
                            {showAvailability ? (
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
                            ) : null}
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
                        <div className={styles.note}>
                            <span className={styles.noteText}>
                                Prices in SEK ({getPriceDisplaySuffix(priceDisplayMode)}) · Stock updated in real time
                            </span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loading}>Loading products…</div>
                ) : (products?.length ?? 0) === 0 ? (
                    <>
                        <div className={styles.comingSoonBar} role="status" aria-live="polite">
                            New products are coming soon — check back shortly.
                        </div>
                        <div className={styles.emptyState}>
                            <p>No products available right now.</p>
                            <Link to="/contact" className={styles.emptyStateLink}>Contact us</Link>
                        </div>
                    </>
                ) : inStock.length > 0 ? (
                    <div className={`${styles.grid} ${isSingleProduct ? styles.singleGrid : ''}`}>
                        {inStock.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                pending={pendingProductId === product.id}
                                onAdd={({ quantity, variantId }) => addToCart(variantId, quantity, product.id)}
                                layout={isSingleProduct ? 'single' : 'grid'}
                            />
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyState}>No products match your filters.</div>
                )}
            </section>

            {outOfStock.length > 0 && (
                <section className={styles.section}>
                    <div className={styles.sectionHead}>
                        <div>
                            <p className={styles.sectionKicker}>Restocking</p>
                            <h2>More items on the way</h2>
                        </div>
                        <p className={styles.sectionNote}>We&apos;ll make these available again shortly.</p>
                    </div>
                    <div className={`${styles.grid} ${isSingleProduct ? styles.singleGrid : ''}`}>
                        {outOfStock.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                pending={pendingProductId === product.id}
                                onAdd={({ quantity, variantId }) => addToCart(variantId, quantity, product.id)}
                                layout={isSingleProduct ? 'single' : 'grid'}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
