import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCustomerProfile } from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import { getCartItemDisplayName } from '../../utils/storeVariants.js';
import styles from './Checkout.module.css';

const initialForm = {
    email: '',
    fullName: '',
    phone: '',
    notes: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: 'SE',
};

const normalizeProfile = (payload) => {
    const source = payload?.user ?? payload ?? {};
    const email = source.email ?? source.username ?? '';
    const fullName = source.fullName ?? source.name ?? source.displayName ?? '';
    const phone = source.phone ?? source.phoneNumber ?? '';

    return {
        email,
        fullName,
        phone,
    };
};

export default function Checkout() {
    const { cart, createCheckoutSession, notify } = useStorefront();
    const { isAuthenticated, token, logout } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const [form, setForm] = useState(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [profile, setProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    const totals = cart?.totals || {};
    const currency = totals.currency || cart?.currency || 'SEK';
    const hasItems = (cart?.items?.length ?? 0) > 0;

    const summaryItems = useMemo(() => cart?.items ?? [], [cart?.items]);
    const profileEmail = profile?.email || '';
    const orderEmail = isAuthenticated ? profileEmail : form.email;
    const canSubmit = hasItems && !submitting && (!isAuthenticated || Boolean(orderEmail));

    useEffect(() => {
        if (!isAuthenticated || !token) {
            setProfile(null);
            return;
        }

        const controller = new AbortController();
        setLoadingProfile(true);
        fetchCustomerProfile(token, { signal: controller.signal, onUnauthorized: redirectToLogin })
            .then((payload) => {
                if (!payload) return;
                const normalized = normalizeProfile(payload);
                setProfile(normalized);
                setForm((prev) => ({
                    ...prev,
                    fullName: prev.fullName || normalized.fullName,
                    phone: prev.phone || normalized.phone,
                }));
            })
            .catch((err) => {
                if (err?.name !== 'AbortError') {
                    setError(err?.message || 'Unable to load your account details.');
                }
            })
            .finally(() => setLoadingProfile(false));

        return () => controller.abort();
    }, [isAuthenticated, redirectToLogin, token]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        setStatusMessage('');
        if (!orderEmail) {
            setError('Please provide an email address to continue.');
            setSubmitting(false);
            return;
        }
        if (!hasItems) {
            setError('Your cart is empty.');
            setSubmitting(false);
            return;
        }
        try {
            notify('info', 'Starting secure checkout…');
            setStatusMessage('Creating your order…');
            const response = await createCheckoutSession({
                email: orderEmail,
                shippingAddress: {
                    name: form.fullName,
                    addressLine1: form.addressLine1,
                    addressLine2: form.addressLine2,
                    postalCode: form.postalCode,
                    city: form.city,
                    country: form.country || 'SE',
                    phone: form.phone,
                },
                notes: form.notes,
            });
            setStatusMessage('Redirecting to Stripe Checkout…');
            notify('success', 'Checkout session created. Redirecting…');

            if (response?.paymentUrl) {
                window.location.assign(response.paymentUrl);
                return;
            }

            throw new Error('Checkout session did not return a payment URL.');
        } catch (err) {
            const message = err?.message || 'Checkout failed. Please try again.';
            setError(message);
            notify('error', message);
        } finally {
            setSubmitting(false);
            setStatusMessage('');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Checkout</p>
                    <h1>Confirm your order</h1>
                    <p className={styles.subtitle}>Share your contact details for local pickup in Stockholm.</p>
                </div>
                <Link to="/store/cart" className={styles.link}>View cart</Link>
            </header>

            {!hasItems ? (
                <div className={styles.empty}>
                    <p>Your cart is empty.</p>
                    <Link to="/store" className={styles.primary}>Browse products</Link>
                </div>
            ) : (
                <div className={styles.layout}>
                    <form className={styles.form} onSubmit={handleSubmit}>
                        {isAuthenticated ? (
                            <>
                                <div className={styles.accountNote}>
                                    <span>
                                        Ordering as {profileEmail || 'your account'}.
                                    </span>
                                    <button type="button" className={styles.logoutLink} onClick={() => logout({ redirect: false })}>
                                        Log out
                                    </button>
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={profileEmail}
                                        readOnly
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={styles.guestIntro}>
                                    <h2 className={styles.guestTitle}>Checkout as guest</h2>
                                    <p className={styles.guestSubtitle}>
                                        No account needed. Enter your email to receive order updates.
                                    </p>
                                    <Link className={styles.guestLink} to="/login?next=/store/checkout">
                                        Have an account? Log in
                                    </Link>
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label htmlFor="email">Email</label>
                                    <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} />
                                </div>
                            </>
                        )}
                        <div className={styles.fieldGroup}>
                            <label htmlFor="fullName">Full name</label>
                            <input id="fullName" name="fullName" type="text" required value={form.fullName} onChange={handleChange} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="phone">Phone</label>
                            <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="addressLine1">Address line 1</label>
                            <input
                                id="addressLine1"
                                name="addressLine1"
                                type="text"
                                required
                                value={form.addressLine1}
                                onChange={handleChange}
                            />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="addressLine2">Address line 2 (optional)</label>
                            <input
                                id="addressLine2"
                                name="addressLine2"
                                type="text"
                                value={form.addressLine2}
                                onChange={handleChange}
                            />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="postalCode">Postal code</label>
                            <input
                                id="postalCode"
                                name="postalCode"
                                type="text"
                                required
                                value={form.postalCode}
                                onChange={handleChange}
                            />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="city">City</label>
                            <input
                                id="city"
                                name="city"
                                type="text"
                                required
                                value={form.city}
                                onChange={handleChange}
                            />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="notes">Notes</label>
                            <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows={3} />
                        </div>
                        {error ? <p className={styles.error}>{error}</p> : null}
                        {statusMessage ? <p className={styles.status}>{statusMessage}</p> : null}
                        <button type="submit" className={styles.submit} disabled={!canSubmit || loadingProfile}>
                            {submitting ? 'Starting checkout…' : `Pay ${formatCurrency(totals.total ?? totals.subtotal ?? 0, currency)}`}
                        </button>
                    </form>

                    <aside className={styles.summary}>
                        <h3>Order summary</h3>
                        <div className={styles.items}>
                            {summaryItems.map((item) => (
                                <div key={item.id || item.productId} className={styles.item}>
                                    <div>
                                        <p className={styles.itemName}>{getCartItemDisplayName(item)}</p>
                                        <p className={styles.itemMeta}>{item.quantity ?? item.qty ?? 1} × {formatCurrency(item.price ?? item.unitPrice ?? 0, currency)}</p>
                                    </div>
                                    <span>{formatCurrency(item.total ?? item.lineTotal ?? (item.quantity ?? item.qty ?? 1) * (item.price ?? 0), currency)}</span>
                                </div>
                            ))}
                        </div>
                        <div className={styles.row}>
                            <span>Subtotal</span>
                            <span>{formatCurrency(totals.subtotal ?? totals.total ?? 0, currency)}</span>
                        </div>
                        <div className={styles.row}>
                            <span>Fulfillment</span>
                            <span>Local pickup (Stockholm) – free</span>
                        </div>
                        <div className={styles.pickupNote}>Pickup confirmed after payment. We&apos;ll email the details.</div>
                        <div className={`${styles.row} ${styles.total}`}>
                            <span>Total ({currencyLabel(currency)})</span>
                            <span>{formatCurrency(totals.total ?? totals.subtotal ?? 0, currency)}</span>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
