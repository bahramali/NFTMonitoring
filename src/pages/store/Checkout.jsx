import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { currencyLabel, formatCurrency } from '../../utils/currency.js';
import styles from './Checkout.module.css';

const initialForm = {
    email: '',
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postalCode: '',
    country: 'Sweden',
    notes: '',
};

export default function Checkout() {
    const { cart, createCheckoutSession } = useStorefront();
    const [form, setForm] = useState(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const totals = cart?.totals || {};
    const currency = totals.currency || cart?.currency || 'SEK';
    const hasItems = (cart?.items?.length ?? 0) > 0;

    const summaryItems = useMemo(() => cart?.items ?? [], [cart?.items]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const response = await createCheckoutSession({
                email: form.email,
                fullName: form.fullName,
                phone: form.phone,
                address: {
                    line1: form.addressLine1,
                    line2: form.addressLine2,
                    city: form.city,
                    postalCode: form.postalCode,
                    country: form.country,
                },
                notes: form.notes,
            });
            if (response?.redirectUrl) {
                window.location.assign(response.redirectUrl);
            } else {
                throw new Error('Checkout session did not return a redirect URL.');
            }
        } catch (err) {
            setError(err?.message || 'Checkout failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Checkout</p>
                    <h1>Confirm your order</h1>
                    <p className={styles.subtitle}>Enter delivery details to confirm your SEK total.</p>
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
                        <div className={styles.fieldGroup}>
                            <label htmlFor="email">Email</label>
                            <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} />
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="fullName">Full name</label>
                            <input id="fullName" name="fullName" type="text" required value={form.fullName} onChange={handleChange} />
                        </div>
                        <div className={styles.inlineFields}>
                            <div className={styles.fieldGroup}>
                                <label htmlFor="phone">Phone</label>
                                <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label htmlFor="country">Country</label>
                                <input id="country" name="country" type="text" value={form.country} onChange={handleChange} />
                            </div>
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="addressLine1">Address</label>
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
                            <label htmlFor="addressLine2">Apartment, suite, etc.</label>
                            <input id="addressLine2" name="addressLine2" type="text" value={form.addressLine2} onChange={handleChange} />
                        </div>
                        <div className={styles.inlineFields}>
                            <div className={styles.fieldGroup}>
                                <label htmlFor="city">City</label>
                                <input id="city" name="city" type="text" required value={form.city} onChange={handleChange} />
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
                        </div>
                        <div className={styles.fieldGroup}>
                            <label htmlFor="notes">Notes</label>
                            <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows={3} />
                        </div>
                        {error ? <p className={styles.error}>{error}</p> : null}
                        <button type="submit" className={styles.submit} disabled={submitting}>
                            {submitting ? 'Starting checkout…' : 'Pay'}
                        </button>
                    </form>

                    <aside className={styles.summary}>
                        <h3>Order summary</h3>
                        <div className={styles.items}>
                            {summaryItems.map((item) => (
                                <div key={item.id || item.productId} className={styles.item}>
                                    <div>
                                        <p className={styles.itemName}>{item.name}</p>
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
                        {totals.shipping !== undefined && (
                            <div className={styles.row}>
                                <span>Shipping</span>
                                <span>{formatCurrency(totals.shipping, currency)}</span>
                            </div>
                        )}
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
