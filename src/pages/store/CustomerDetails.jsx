import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    createAdminCustomerCoupon,
    fetchAdminCustomer,
    normalizeCustomerId,
    listAdminCustomerCoupons,
} from '../../api/adminCustomers.js';
import { listAdminProducts } from '../../api/products.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../utils/currency.js';
import { mapOrderStatus } from '../../utils/orderStatus.js';
import styles from './CustomerDetails.module.css';

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('sv-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getErrorMessage = (error, fallback) => {
    if (!error) return fallback;
    if (error.status === 401 || error.status === 403) return 'Admin permission required';
    const details = error?.payload?.errors;
    if (Array.isArray(details) && details.length > 0) {
        const message = details
            .map((entry) => entry?.message || entry?.msg || entry?.detail || entry)
            .filter(Boolean)
            .join(', ');
        if (message) return message;
    }
    if (typeof details === 'string') return details;
    return error?.message || fallback;
};

const flattenVariants = (products = []) =>
    products.flatMap((product) => {
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        return variants
            .filter((variant) => variant?.id)
            .map((variant) => ({
                id: variant.id,
                label: `${product?.name || 'Product'} ${variant?.weight ? `${variant.weight}g` : variant?.name || ''}`.trim(),
            }));
    });

const maskCouponCode = (code) => {
    if (!code) return '••••••';
    const normalized = `${code}`;
    if (normalized.length <= 4) return '••••';
    const visibleTail = normalized.slice(-4);
    return `${'•'.repeat(Math.max(4, normalized.length - 4))}${visibleTail}`;
};

export default function CustomerDetails() {
    const { customerId } = useParams();
    const normalizedCustomerId = normalizeCustomerId(customerId);
    const { token } = useAuth();
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [variants, setVariants] = useState([]);
    const [variantSearch, setVariantSearch] = useState('');
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [amountOffSek, setAmountOffSek] = useState('');
    const [expiryAt, setExpiryAt] = useState('');
    const [isSubmittingCoupon, setIsSubmittingCoupon] = useState(false);
    const [couponError, setCouponError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [copyState, setCopyState] = useState('idle');

    const [coupons, setCoupons] = useState([]);
    const [couponListLoading, setCouponListLoading] = useState(false);
    const [couponListError, setCouponListError] = useState('');

    useEffect(() => {
        if (!token || !normalizedCustomerId) return;
        const controller = new AbortController();
        const loadCustomer = async () => {
            setLoading(true);
            setError('');
            try {
                const payload = await fetchAdminCustomer(normalizedCustomerId, token, { signal: controller.signal });
                setCustomer(payload);
            } catch (loadError) {
                console.error('Failed to load customer details', loadError);
                setError(getErrorMessage(loadError, 'Unable to load customer details right now.'));
                setCustomer(null);
            } finally {
                setLoading(false);
            }
        };

        loadCustomer();

        return () => controller.abort();
    }, [normalizedCustomerId, token]);

    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();

        listAdminProducts(token, { signal: controller.signal })
            .then((products) => {
                const options = flattenVariants(products);
                setVariants(options);
                if (!selectedVariantId && options.length > 0) {
                    setSelectedVariantId(options[0].id);
                }
            })
            .catch((loadError) => {
                console.error('Failed to load variants for coupon creation', loadError);
                setCouponError(getErrorMessage(loadError, 'Unable to load variants.'));
            });

        return () => controller.abort();
    }, [selectedVariantId, token]);

    const reloadCoupons = useCallback(async (signal) => {
        if (!token || !normalizedCustomerId) return;
        setCouponListLoading(true);
        setCouponListError('');
        try {
            const result = await listAdminCustomerCoupons(normalizedCustomerId, token, { signal });
            setCoupons(result);
        } catch (loadError) {
            console.error('Failed to load coupons', loadError);
            setCouponListError(getErrorMessage(loadError, 'Unable to load customer coupons.'));
            setCoupons([]);
        } finally {
            setCouponListLoading(false);
        }
    }, [normalizedCustomerId, token]);

    useEffect(() => {
        const controller = new AbortController();
        reloadCoupons(controller.signal);
        return () => controller.abort();
    }, [reloadCoupons]);

    const filteredVariants = useMemo(() => {
        const query = variantSearch.trim().toLowerCase();
        if (!query) return variants;
        return variants.filter((variant) => variant.label.toLowerCase().includes(query));
    }, [variantSearch, variants]);

    const handleSubmitCoupon = async (event) => {
        event.preventDefault();
        setCouponError('');
        setSuccessMessage('');
        setGeneratedCode('');
        setCopyState('idle');

        if (!selectedVariantId) {
            setCouponError('Select a variant before generating a code.');
            return;
        }

        const amountSekNumber = Number.parseFloat(amountOffSek);
        if (!Number.isFinite(amountSekNumber) || amountSekNumber <= 0) {
            setCouponError('Enter a valid amount off in SEK.');
            return;
        }

        const amountOffCents = Math.round(amountSekNumber * 100);
        const payload = {
            variantId: selectedVariantId,
            amountOffCents,
            ...(expiryAt ? { expiresAt: new Date(expiryAt).toISOString() } : {}),
        };

        setIsSubmittingCoupon(true);
        try {
            const created = await createAdminCustomerCoupon(normalizedCustomerId, payload, token);
            const nextCode = created?.couponCode || '';
            setGeneratedCode(nextCode);
            setSuccessMessage('Code generated. Share it with the customer.');
            await reloadCoupons();
        } catch (submitError) {
            console.error('Failed to create coupon', submitError);
            setCouponError(getErrorMessage(submitError, 'Unable to generate discount code.'));
        } finally {
            setIsSubmittingCoupon(false);
        }
    };

    const handleCopyCode = async () => {
        if (!generatedCode) return;
        try {
            await navigator.clipboard.writeText(generatedCode);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    };

    if (!normalizedCustomerId) {
        return (
            <section className={styles.wrapper}>
                <Link to="/store/admin/customers" className={styles.backLink}>
                    ← Back to customers
                </Link>
                <div className={styles.emptyState}>
                    <h1>Customer not found</h1>
                    <p>Invalid customer id.</p>
                </div>
            </section>
        );
    }

    if (loading) {
        return (
            <section className={styles.wrapper}>
                <Link to="/store/admin/customers" className={styles.backLink}>
                    ← Back to customers
                </Link>
                <div className={styles.emptyState}>
                    <h1>Loading customer</h1>
                    <p>Fetching the latest customer details…</p>
                </div>
            </section>
        );
    }

    if (error || !customer) {
        return (
            <section className={styles.wrapper}>
                <Link to="/store/admin/customers" className={styles.backLink}>
                    ← Back to customers
                </Link>
                <div className={styles.emptyState}>
                    <h1>Customer not found</h1>
                    <p>{error || 'We couldn’t locate that customer. Please return to the list and try again.'}</p>
                </div>
            </section>
        );
    }

    const statusKey = `${customer.status || ''}`.replace(' ', '');

    return (
        <section className={styles.wrapper}>
            <Link to="/store/admin/customers" className={styles.backLink}>
                ← Back to customers
            </Link>

            <div className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Store → Customers</p>
                    <h1>{customer.name}</h1>
                    <p className={styles.subtitle}>Read-only profile overview and order history.</p>
                </div>
                <span className={`${styles.status} ${styles[`status${statusKey}`]}`}>
                    {customer.status || '—'}
                </span>
            </div>

            <div className={styles.profileGrid}>
                <div className={styles.profileCard}>
                    <h2>Profile</h2>
                    <dl>
                        <div>
                            <dt>Name</dt>
                            <dd>{customer.name}</dd>
                        </div>
                        <div>
                            <dt>Email</dt>
                            <dd>{customer.email}</dd>
                        </div>
                        <div>
                            <dt>Customer type</dt>
                            <dd>{customer.type || '—'}</dd>
                        </div>
                        <div>
                            <dt>Last order</dt>
                            <dd>{formatDate(customer.lastOrderDate)}</dd>
                        </div>
                        <div>
                            <dt>Total spent</dt>
                            <dd>{formatCurrency(customer.totalSpent, customer.currency || 'SEK')}</dd>
                        </div>
                    </dl>
                </div>
                <div className={styles.profileCard}>
                    <h2>GDPR-safe notes</h2>
                    <ul>
                        <li>No payment details stored in this view.</li>
                        <li>No passwords or technical identifiers shown.</li>
                        <li>Orders are read-only for compliance.</li>
                    </ul>
                </div>
            </div>

            <div className={styles.couponSection}>
                <div className={styles.ordersHeader}>
                    <h2>Generate discount code</h2>
                </div>
                <form className={styles.couponForm} onSubmit={handleSubmitCoupon}>
                    <label>
                        <span>Search variants</span>
                        <input
                            type="search"
                            placeholder="Search by product or weight"
                            value={variantSearch}
                            onChange={(event) => setVariantSearch(event.target.value)}
                        />
                    </label>
                    <label>
                        <span>Variant</span>
                        <select
                            value={selectedVariantId}
                            onChange={(event) => setSelectedVariantId(event.target.value)}
                            disabled={isSubmittingCoupon}
                            required
                        >
                            {!filteredVariants.length ? <option value="">No variants found</option> : null}
                            {filteredVariants.map((variant) => (
                                <option key={variant.id} value={variant.id}>
                                    {variant.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Amount off (SEK)</span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={amountOffSek}
                            onChange={(event) => setAmountOffSek(event.target.value)}
                            disabled={isSubmittingCoupon}
                            required
                        />
                    </label>
                    <label>
                        <span>Expiry date/time (optional)</span>
                        <input
                            type="datetime-local"
                            value={expiryAt}
                            onChange={(event) => setExpiryAt(event.target.value)}
                            disabled={isSubmittingCoupon}
                        />
                    </label>
                    <button type="submit" disabled={isSubmittingCoupon || !selectedVariantId}>
                        {isSubmittingCoupon ? 'Generating…' : 'Generate discount code'}
                    </button>
                </form>
                {couponError ? <p className={styles.errorMessage}>{couponError}</p> : null}
                {successMessage ? <p className={styles.successMessage}>{successMessage}</p> : null}
                {generatedCode ? (
                    <div className={styles.generatedCodeWrap}>
                        <label>
                            <span>Generated code</span>
                            <input type="text" value={generatedCode} readOnly />
                        </label>
                        <button type="button" onClick={handleCopyCode}>
                            Copy
                        </button>
                        {copyState === 'copied' ? <span className={styles.copyFeedback}>Copied</span> : null}
                        {copyState === 'failed' ? (
                            <span className={styles.errorMessage}>Copy failed. Please copy manually.</span>
                        ) : null}
                    </div>
                ) : null}

                <div className={styles.ordersHeader}>
                    <h3>Existing customer coupons</h3>
                </div>
                {couponListError ? <p className={styles.errorMessage}>{couponListError}</p> : null}
                {couponListLoading ? <div className={styles.emptyState}>Loading coupons…</div> : null}
                {!couponListLoading && !couponListError ? (
                    <div className={styles.ordersTable}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Variant</th>
                                    <th>Amount off</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Expiry</th>
                                    <th>Code</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coupons.map((coupon) => (
                                    <tr key={coupon.id || `${coupon.variantId}-${coupon.createdAt}`}>
                                        <td>{coupon.variantLabel || '—'}</td>
                                        <td>{`-${formatCurrency((coupon.amountOffCents || 0) / 100, 'SEK')}`}</td>
                                        <td>
                                            <span className={styles.orderStatus}>{coupon.status || 'Active'}</span>
                                        </td>
                                        <td>{formatDateTime(coupon.createdAt)}</td>
                                        <td>{formatDateTime(coupon.expiresAt)}</td>
                                        <td>{maskCouponCode(coupon.couponCode)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!coupons.length ? <div className={styles.emptyState}>No coupons created for this customer yet.</div> : null}
                    </div>
                ) : null}
            </div>

            <div className={styles.ordersSection}>
                <div className={styles.ordersHeader}>
                    <h2>Orders</h2>
                    <span className={styles.orderCount}>{customer.orders?.length ?? 0} total</span>
                </div>
                <div className={styles.ordersTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Status</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(customer.orders || []).map((order) => (
                                <tr key={order.id || `${customer.id}-${order.date}-${order.total}`}>
                                    <td>{formatDate(order.date)}</td>
                                    <td>{order.items || '—'}</td>
                                    <td>
                                        <span className={styles.orderStatus}>{mapOrderStatus(order.status).label}</span>
                                    </td>
                                    <td>{formatCurrency(order.total, order.currency || customer.currency || 'SEK')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!customer.orders?.length && <div className={styles.emptyState}>No orders found for this customer.</div>}
                </div>
            </div>
        </section>
    );
}
