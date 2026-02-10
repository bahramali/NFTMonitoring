import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCustomerAddress, fetchCustomerAddresses, setDefaultCustomerAddress } from '../../api/customerAddresses.js';
import { fetchCustomerProfile } from '../../api/customer.js';
import { createStripeCheckoutSession } from '../../api/store.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { extractAddressList, formatAddressLine, normalizeAddress } from '../customer/addressUtils.js';
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
    state: '',
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

const toAddressPayload = (values) => ({
    fullName: values.fullName?.trim() || null,
    street1: values.addressLine1?.trim() || '',
    street2: values.addressLine2?.trim() || null,
    postalCode: values.postalCode?.trim() || '',
    city: values.city?.trim() || '',
    region: values.state?.trim() || null,
    countryCode: (values.country || '').trim().length === 2 ? values.country.trim().toUpperCase() : '',
    phoneNumber: values.phone?.trim() || null,
});

const getCheckoutErrorMessage = (error) => {
    const status = error?.status;

    if (status === 401 || status === 403) {
        return 'Please sign in again.';
    }
    if (status === 409) {
        return 'Cart changed, refresh cart.';
    }
    if (status === 422) {
        return error?.message || 'Invalid cart.';
    }
    if (status >= 500) {
        return 'Checkout unavailable, try again later.';
    }

    return error?.message || 'Checkout failed. Please try again.';
};

const logCheckoutError = (error) => {
    const payloadMessage =
        typeof error?.payload === 'string'
            ? error.payload
            : error?.payload?.message;

    console.error('Checkout session creation failed.', {
        status: error?.status,
        message: error?.message,
        payloadMessage,
    });
};

export default function Checkout() {
    const { cart, cartId, sessionId, notify } = useStorefront();
    const { isAuthenticated, token, logout } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const [form, setForm] = useState(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [profile, setProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [addressMode, setAddressMode] = useState('new');
    const [loadingAddresses, setLoadingAddresses] = useState(false);
    const [addressError, setAddressError] = useState(null);
    const [saveNewAddress, setSaveNewAddress] = useState(true);
    const checkoutInFlight = useRef(false);

    const totals = cart?.totals || {};
    const currency = totals.currency || cart?.currency || 'SEK';
    const hasItems = (cart?.items?.length ?? 0) > 0;

    const summaryItems = useMemo(() => cart?.items ?? [], [cart?.items]);
    const profileEmail = profile?.email || '';
    const orderEmail = isAuthenticated ? profileEmail : form.email;
    const canSubmit = hasItems && !submitting && (!isAuthenticated || Boolean(orderEmail));
    const selectedAddress = useMemo(
        () => addresses.find((address) => String(address.id) === String(selectedAddressId)),
        [addresses, selectedAddressId],
    );

    const applyAddressToForm = useCallback((address) => {
        if (!address) return;
        setForm((prev) => ({
            ...prev,
            fullName: address.fullName || prev.fullName,
            phone: address.phone || prev.phone,
            addressLine1: address.line1 || '',
            addressLine2: address.line2 || '',
            postalCode: address.postalCode || '',
            city: address.city || '',
            state: address.state || '',
            country: address.country || prev.country || 'SE',
        }));
    }, []);

    const clearAddressFields = useCallback(() => {
        setForm((prev) => ({
            ...prev,
            addressLine1: '',
            addressLine2: '',
            postalCode: '',
            city: '',
            state: '',
            country: prev.country || 'SE',
        }));
    }, []);

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

    useEffect(() => {
        if (!isAuthenticated || !token) {
            setAddresses([]);
            setSelectedAddressId(null);
            setAddressMode('new');
            setAddressError(null);
            setLoadingAddresses(false);
            return;
        }

        const controller = new AbortController();
        setLoadingAddresses(true);
        setAddressError(null);
        fetchCustomerAddresses(token, { signal: controller.signal, onUnauthorized: redirectToLogin })
            .then((payload) => {
                if (payload === null) return;
                const list = extractAddressList(payload).map(normalizeAddress);
                setAddresses(list);

                if (list.length === 0) {
                    setSelectedAddressId(null);
                    setAddressMode('new');
                    clearAddressFields();
                    return;
                }

                const selected = list.length === 1
                    ? list[0]
                    : list.find((address) => address.isDefault) || list[0];
                setSelectedAddressId(selected.id);
                setAddressMode('saved');
                applyAddressToForm(selected);
            })
            .catch((err) => {
                if (err?.name === 'AbortError') return;
                if (err?.isUnsupported) {
                    setAddressError('Address book is not enabled yet.');
                } else {
                    setAddressError(err?.message || 'Unable to load addresses.');
                }
                setAddresses([]);
                setSelectedAddressId(null);
                setAddressMode('new');
            })
            .finally(() => setLoadingAddresses(false));

        return () => controller.abort();
    }, [applyAddressToForm, clearAddressFields, isAuthenticated, redirectToLogin, token]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddressSelection = (event) => {
        const selectedId = event.target.value;
        setSelectedAddressId(selectedId);
        setAddressMode('saved');
        const selected = addresses.find((address) => String(address.id) === String(selectedId));
        if (selected) {
            applyAddressToForm(selected);
        }
    };

    const handleUseDifferentAddress = () => {
        setAddressMode('new');
        clearAddressFields();
    };

    const handleUseSavedAddress = () => {
        const selected = selectedAddress || addresses[0];
        if (selected) {
            setSelectedAddressId(selected.id);
            applyAddressToForm(selected);
        }
        setAddressMode('saved');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (checkoutInFlight.current) {
            return;
        }
        checkoutInFlight.current = true;
        setSubmitting(true);
        setError(null);
        setStatusMessage('');
        if (!orderEmail) {
            setError('Please provide an email address to continue.');
            setSubmitting(false);
            checkoutInFlight.current = false;
            return;
        }
        if (!hasItems) {
            setError('Your cart is empty.');
            setSubmitting(false);
            checkoutInFlight.current = false;
            return;
        }
        try {
            if (isAuthenticated && token && addressMode === 'new' && saveNewAddress) {
                try {
                    const isFirstAddress = addresses.length === 0;
                    const payload = toAddressPayload(form);
                    const created = await createCustomerAddress(token, payload, { onUnauthorized: redirectToLogin });
                    if (created) {
                        const normalized = normalizeAddress(created);
                        if (normalized?.id) {
                            if (isFirstAddress) {
                                normalized.isDefault = true;
                            }
                            setAddresses((prev) => [...prev, normalized]);
                            setSelectedAddressId(normalized.id);
                            setAddressMode('saved');
                            if (isFirstAddress) {
                                try {
                                    await setDefaultCustomerAddress(token, normalized.id, { onUnauthorized: redirectToLogin });
                                    setAddresses((prev) => prev.map((address) => ({
                                        ...address,
                                        isDefault: String(address.id) === String(normalized.id),
                                    })));
                                } catch (defaultError) {
                                    if (defaultError?.isUnsupported) {
                                        setAddressError('Address book is not enabled yet.');
                                    } else {
                                        setAddressError(defaultError?.message || 'Unable to set a default address.');
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    if (err?.isUnsupported) {
                        setAddressError('Address book is not enabled yet.');
                    } else {
                        setAddressError(err?.message || 'Unable to save your address.');
                    }
                }
            }
            notify('info', 'Starting Stripe Checkout…');
            setStatusMessage('Requesting Stripe Checkout…');
            const shippingAddress = {
                name: form.fullName?.trim() || '',
                phone: form.phone?.trim() || '',
                addressLine1: form.addressLine1?.trim() || '',
                addressLine2: form.addressLine2?.trim() || '',
                postalCode: form.postalCode?.trim() || '',
                city: form.city?.trim() || '',
                state: form.state?.trim() || '',
                country: (form.country || 'SE').trim(),
            };
            const response = await createStripeCheckoutSession(token, {
                cartId,
                email: orderEmail,
                shippingAddress,
            });
            setStatusMessage('Redirecting to Stripe Checkout…');
            notify('success', 'Checkout session created. Redirecting…');

            if (response?.checkoutUrl) {
                window.location.assign(response.checkoutUrl);
                return;
            }

            throw new Error('Checkout session did not return a Stripe URL.');
        } catch (err) {
            logCheckoutError(err);
            const message = getCheckoutErrorMessage(err);
            setError(message);
            notify('error', message);
        } finally {
            setSubmitting(false);
            setStatusMessage('');
            checkoutInFlight.current = false;
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
                        {isAuthenticated ? (
                            <div className={styles.fieldGroup}>
                                <label htmlFor="saved-address">Saved address</label>
                                {loadingAddresses ? (
                                    <p>Loading saved addresses…</p>
                                ) : null}
                                {addressError ? (
                                    <p className={styles.error} role="alert">
                                        {addressError}
                                    </p>
                                ) : null}
                                {!loadingAddresses && addresses.length === 0 ? (
                                    <p>Add a new address below to save time next time.</p>
                                ) : null}
                                {!loadingAddresses && addresses.length === 1 ? (
                                    <div className={styles.addressCard}>
                                        <p className={styles.addressTitle}>
                                            {addresses[0].label || 'Default address'}
                                        </p>
                                        <p className={styles.addressLine}>{formatAddressLine(addresses[0])}</p>
                                    </div>
                                ) : null}
                                {!loadingAddresses && addresses.length > 1 ? (
                                    <select
                                        id="saved-address"
                                        name="saved-address"
                                        value={selectedAddressId ?? ''}
                                        onChange={handleAddressSelection}
                                    >
                                        {addresses.map((address) => (
                                            <option key={address.id} value={address.id}>
                                                {address.label || formatAddressLine(address) || 'Saved address'}
                                            </option>
                                        ))}
                                    </select>
                                ) : null}
                                {!loadingAddresses && addresses.length > 0 ? (
                                    <div className={styles.addressActions}>
                                        {addressMode === 'saved' ? (
                                            <button
                                                type="button"
                                                className={styles.addressToggle}
                                                onClick={handleUseDifferentAddress}
                                            >
                                                Use a different address
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className={styles.addressToggle}
                                                onClick={handleUseSavedAddress}
                                            >
                                                Use saved address
                                            </button>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {!isAuthenticated || addressMode === 'new' ? (
                            <>
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
                                    <label htmlFor="state">State/Region (optional)</label>
                                    <input
                                        id="state"
                                        name="state"
                                        type="text"
                                        value={form.state}
                                        onChange={handleChange}
                                    />
                                </div>
                                {isAuthenticated ? (
                                    <label className={styles.checkboxRow} htmlFor="saveAddress">
                                        <input
                                            id="saveAddress"
                                            name="saveAddress"
                                            type="checkbox"
                                            checked={saveNewAddress}
                                            onChange={(event) => setSaveNewAddress(event.target.checked)}
                                        />
                                        Save this address
                                    </label>
                                ) : null}
                            </>
                        ) : null}
                        <div className={styles.fieldGroup}>
                            <label htmlFor="notes">Notes</label>
                            <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows={3} />
                        </div>
                        {error ? <p className={styles.error}>{error}</p> : null}
                        {statusMessage ? <p className={styles.status}>{statusMessage}</p> : null}
                        <button type="submit" className={styles.submit} disabled={!canSubmit || loadingProfile}>
                            {submitting ? (
                                <span className={styles.submitContent}>
                                    <span className={styles.spinner} aria-hidden="true" />
                                    <span>Starting checkout…</span>
                                </span>
                            ) : (
                                `Pay ${formatCurrency(totals.total ?? totals.subtotal ?? 0, currency)}`
                            )}
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
