import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCustomerAddress, fetchCustomerAddresses, setDefaultCustomerAddress } from '../../api/customerAddresses.js';
import { fetchCustomerProfile } from '../../api/customer.js';
import {
    applyStoreCoupon,
    createStripeCheckoutSession,
    fetchStoreCart,
    normalizeCartResponse,
} from '../../api/store.js';
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
    customerType: 'B2C',
    companyName: '',
    orgNumber: '',
    vatNumber: '',
    invoiceEmail: '',
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


const getCouponErrorMessage = (error) => {
    const payload = error?.payload ?? {};
    const detailErrors = Array.isArray(payload?.errors) ? payload.errors : [];
    const topLevelCode = `${payload?.code ?? payload?.errorCode ?? payload?.error?.code ?? ''}`.trim().toUpperCase();
    const detailCode = `${detailErrors[0]?.code ?? detailErrors[0]?.errorCode ?? ''}`.trim().toUpperCase();
    const code = topLevelCode || detailCode;

    const topLevelMessage = `${payload?.message ?? payload?.error?.message ?? ''}`.trim();
    const detailMessage = `${detailErrors[0]?.message ?? detailErrors[0]?.msg ?? detailErrors[0]?.detail ?? ''}`.trim();
    const backendMessage = topLevelMessage || detailMessage;

    if (error?.status === 401 || error?.status === 403) {
        if (code === 'COUPON_LOGIN_REQUIRED') {
            return 'Please log in to use your coupon';
        }
    }

    if (backendMessage) {
        return backendMessage;
    }

    if (code === 'COUPON_EXPIRED') return 'Coupon expired';
    if (code === 'COUPON_ALREADY_REDEEMED') return 'Coupon already redeemed';
    if (code === 'COUPON_NOT_APPLICABLE') return 'Coupon not applicable to this product';
    if (code === 'COUPON_NOT_ACTIVE') return 'Coupon not active';
    if (code) return code;

    return 'Invalid coupon code';
};



const toPricedCart = (payload, fallback = {}) => {
    if (!payload) return null;

    const normalized = normalizeCartResponse(payload, fallback);
    if (normalized?.totals || Array.isArray(normalized?.items)) {
        return normalized;
    }

    const nested = payload?.cart ?? payload?.data?.cart ?? payload?.result?.cart ?? payload?.checkout?.cart ?? null;
    return normalizeCartResponse(nested, fallback);
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
    const { cart, cartId, sessionId, notify, refreshCart } = useStorefront();
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
    const [couponCode, setCouponCode] = useState('');
    const [couponStatus, setCouponStatus] = useState('idle');
    const [totalsRefreshing, setTotalsRefreshing] = useState(false);
    const [couponMessage, setCouponMessage] = useState('');
    const [appliedCouponCode, setAppliedCouponCode] = useState('');
    const [pricedCart, setPricedCart] = useState(null);
    const checkoutInFlight = useRef(false);

    const activeCart = pricedCart || cart;
    const totals = activeCart?.totals || {};
    const currency = totals.currency || activeCart?.currency || 'SEK';
    const hasItems = (activeCart?.items?.length ?? 0) > 0;

    const summaryItems = useMemo(() => activeCart?.items ?? [], [activeCart?.items]);
    const profileEmail = profile?.email || '';
    const orderEmail = isAuthenticated ? profileEmail : form.email;
    const isB2B = form.customerType === 'B2B';
    const trimmedCompanyName = form.companyName.trim();
    const trimmedOrgNumber = form.orgNumber.trim();
    const trimmedInvoiceEmail = form.invoiceEmail.trim();
    const isApplyingCoupon = couponStatus === 'loading';
    const canSubmit =
        hasItems
        && !submitting
        && !isApplyingCoupon
        && !totalsRefreshing
        && (!isAuthenticated || Boolean(orderEmail))
        && (!isB2B || (Boolean(trimmedCompanyName) && Boolean(trimmedOrgNumber)));
    const selectedAddress = useMemo(
        () => addresses.find((address) => String(address.id) === String(selectedAddressId)),
        [addresses, selectedAddressId],
    );
    const cartFingerprint = useMemo(
        () => JSON.stringify(((cart?.items) || []).map((item) => ({
            id: item.id || item.productId || item.variantId,
            quantity: item.quantity ?? item.qty ?? 1,
        }))),
        [cart?.items],
    );

    const quoteCurrency = currency;
    const summarySubtotal = totals.subtotal ?? totals.total ?? 0;
    const summaryDiscount = totals.discount ?? 0;
    const summaryShipping = totals.shipping ?? 0;
    const summaryTax = totals.tax ?? 0;
    const summaryTotal = totals.total ?? (summarySubtotal + summaryShipping + summaryTax - summaryDiscount);

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


    const clearCouponState = useCallback(() => {
        setPricedCart(null);
        setCouponCode('');
        setAppliedCouponCode('');
        setCouponStatus('idle');
        setCouponMessage('');
    }, []);

    useEffect(() => {
        clearCouponState();
    }, [cartFingerprint, clearCouponState]);

    const handleApplyCoupon = async () => {
        const normalizedCoupon = couponCode.trim();
        if (!normalizedCoupon || !cartId || isApplyingCoupon || totalsRefreshing) {
            return;
        }

        setCouponStatus('loading');
        setCouponMessage('');
        setTotalsRefreshing(true);
        try {
            let appliedPayload = null;
            try {
                appliedPayload = await applyStoreCoupon(token, {
                    cartId,
                    sessionId,
                    couponCode: normalizedCoupon,
                });
            } catch (applyError) {
                if (applyError?.status !== 404 && applyError?.status !== 405) {
                    throw applyError;
                }
            }

            const fallback = { cartId, sessionId };
            let updatedCart = toPricedCart(appliedPayload, fallback);

            if (!updatedCart) {
                const fetchedCart = await fetchStoreCart(cartId, sessionId);
                updatedCart = normalizeCartResponse(fetchedCart, fallback);
            }

            if (!updatedCart) {
                throw new Error('Failed to refresh cart totals after applying coupon.');
            }

            setPricedCart(updatedCart);
            setAppliedCouponCode(normalizedCoupon);
            setCouponStatus('success');
            setCouponMessage('Coupon applied');

            refreshCart().catch(() => {});
        } catch (err) {
            setCouponStatus('error');
            setCouponMessage(getCouponErrorMessage(err));
        } finally {
            setTotalsRefreshing(false);
        }
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
        if (isB2B && (!trimmedCompanyName || !trimmedOrgNumber)) {
            setError('Company name and org number are required for company checkout.');
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
            const company = isB2B
                ? {
                    companyName: trimmedCompanyName,
                    orgNumber: trimmedOrgNumber,
                    vatNumber: form.vatNumber.trim() || undefined,
                    invoiceEmail: trimmedInvoiceEmail || orderEmail,
                }
                : undefined;

            const response = await createStripeCheckoutSession(token, {
                cartId,
                sessionId,
                email: orderEmail,
                shippingAddress,
                couponCode: appliedCouponCode || undefined,
                customerType: isB2B ? 'B2B' : 'B2C',
                company,
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
                        <fieldset className={styles.customerTypeFieldset}>
                            <legend>Customer type</legend>
                            <label className={styles.radioOption} htmlFor="customerType-b2c">
                                <input
                                    id="customerType-b2c"
                                    type="radio"
                                    name="customerType"
                                    value="B2C"
                                    checked={form.customerType === 'B2C'}
                                    onChange={handleChange}
                                />
                                Private (B2C)
                            </label>
                            <label className={styles.radioOption} htmlFor="customerType-b2b">
                                <input
                                    id="customerType-b2b"
                                    type="radio"
                                    name="customerType"
                                    value="B2B"
                                    checked={form.customerType === 'B2B'}
                                    onChange={handleChange}
                                />
                                Company/Restaurant (B2B)
                            </label>
                        </fieldset>

                        {isB2B ? (
                            <>
                                <div className={styles.fieldGroup}>
                                    <label htmlFor="companyName">Company name</label>
                                    <input
                                        id="companyName"
                                        name="companyName"
                                        type="text"
                                        required={isB2B}
                                        value={form.companyName}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label htmlFor="orgNumber">Org number</label>
                                    <input
                                        id="orgNumber"
                                        name="orgNumber"
                                        type="text"
                                        required={isB2B}
                                        value={form.orgNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label htmlFor="vatNumber">VAT number (optional)</label>
                                    <input
                                        id="vatNumber"
                                        name="vatNumber"
                                        type="text"
                                        value={form.vatNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label htmlFor="invoiceEmail">Invoice email (optional)</label>
                                    <input
                                        id="invoiceEmail"
                                        name="invoiceEmail"
                                        type="email"
                                        value={form.invoiceEmail}
                                        placeholder={orderEmail || 'Defaults to contact email'}
                                        onChange={handleChange}
                                        onBlur={() => {
                                            if (!form.invoiceEmail.trim() && orderEmail) {
                                                setForm((prev) => ({ ...prev, invoiceEmail: orderEmail }));
                                            }
                                        }}
                                    />
                                </div>
                            </>
                        ) : null}

                        <div className={styles.fieldGroup}>
                            <label htmlFor="couponCode">Coupon code</label>
                            <div className={styles.couponRow}>
                                <input
                                    id="couponCode"
                                    name="couponCode"
                                    type="text"
                                    value={couponCode}
                                    onChange={(event) => {
                                        setCouponCode(event.target.value);
                                        setAppliedCouponCode('');
                                        setPricedCart(null);
                                        setCouponStatus('idle');
                                        setCouponMessage('');
                                    }}
                                    placeholder="Enter coupon"
                                />
                                <button
                                    type="button"
                                    className={styles.applyCoupon}
                                    onClick={handleApplyCoupon}
                                    disabled={isApplyingCoupon || totalsRefreshing || !couponCode.trim() || !cartId}
                                >
                                    {isApplyingCoupon || totalsRefreshing ? 'Applying…' : 'Apply'}
                                </button>
                            </div>
                            {couponStatus === 'success' && couponMessage ? <p className={styles.status}>{couponMessage}</p> : null}
                            {couponStatus === 'error' && couponMessage ? <p className={styles.error}>{couponMessage}</p> : null}
                        </div>
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
                                `Pay ${formatCurrency(summaryTotal, quoteCurrency)}`
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
                                        <p className={styles.itemMeta}>
                                            {item.quantity ?? item.qty ?? 1}
                                            {' × '}
                                            {formatCurrency(item.discountedUnitPrice ?? item.price ?? item.unitPrice ?? 0, currency)}
                                        </p>
                                    </div>
                                    <span>
                                        {formatCurrency(
                                            item.discountedLineTotal
                                            ?? item.total
                                            ?? item.lineTotal
                                            ?? (item.quantity ?? item.qty ?? 1) * (item.discountedUnitPrice ?? item.price ?? item.unitPrice ?? 0),
                                            currency,
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className={styles.row}>
                            <span>Subtotal</span>
                            <span>{formatCurrency(summarySubtotal, quoteCurrency)}</span>
                        </div>
                        <div className={styles.row}>
                            <span>Discount</span>
                            <span>-{formatCurrency(summaryDiscount, quoteCurrency)}</span>
                        </div>
                        <div className={styles.row}>
                            <span>Shipping/Pickup fee</span>
                            <span>{formatCurrency(summaryShipping, quoteCurrency)}</span>
                        </div>
                        <div className={styles.row}>
                            <span>Tax</span>
                            <span>{formatCurrency(summaryTax, quoteCurrency)}</span>
                        </div>
                        <div className={styles.pickupNote}>Pickup confirmed after payment. We&apos;ll email the details.</div>
                        <div className={`${styles.row} ${styles.total}`}>
                            <span>Total ({currencyLabel(quoteCurrency)})</span>
                            <span>{formatCurrency(summaryTotal, quoteCurrency)}</span>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
