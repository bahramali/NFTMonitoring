import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCustomerAddress, fetchCustomerAddresses, setDefaultCustomerAddress } from '../../api/customerAddresses.js';
import { fetchCustomerProfile } from '../../api/customer.js';
import {
    applyStoreCoupon,
    checkoutCart,
    createStripeCheckoutSession,
    fetchStoreCart,
    normalizeCartResponse,
} from '../../api/store.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractUserPricingTier } from '../../utils/pricingTier.js';
import { displayLineTotal, displayPrice, getPriceDisplaySuffix, hasBusinessProfile, resolveTotalsBreakdown } from '../../utils/storePricingDisplay.js';
import { normalizeSwedishOrgNumber, validateSwedishOrgNumber } from '../../utils/swedishOrgNumber.js';
import { useStorefront } from '../../context/StorefrontContext.jsx';
import { usePricingDisplay } from '../../context/PricingDisplayContext.jsx';
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
    const navigate = useNavigate();
    const { cart, cartId, sessionId, notify, refreshCart } = useStorefront();
    const { isAuthenticated, token, logout, profile: authProfile } = useAuth();
    const { customerType, priceDisplayMode, vatRate, setCustomerType, setCompanyProfile } = usePricingDisplay();
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
    const [paymentMode, setPaymentMode] = useState('PAY_NOW');
    const checkoutInFlight = useRef(false);

    const activeCart = pricedCart || cart;
    const totals = useMemo(() => activeCart?.totals ?? {}, [activeCart?.totals]);
    const currency = totals.currency || activeCart?.currency || 'SEK';
    const hasItems = (activeCart?.items?.length ?? 0) > 0;

    const summaryItems = useMemo(() => activeCart?.items ?? [], [activeCart?.items]);
    const profileEmail = profile?.email || '';
    const orderEmail = isAuthenticated ? profileEmail : form.email;
    const hasBusinessAccount = hasBusinessProfile(authProfile);
    const isB2BSelected = form.customerType === 'B2B';
    const isB2B = customerType === 'B2B' || isB2BSelected || hasBusinessAccount;
    const trimmedCompanyName = form.companyName.trim();
    const trimmedOrgNumber = form.orgNumber.trim();
    const orgNumberValidation = useMemo(
        () => (isB2BSelected && trimmedOrgNumber ? validateSwedishOrgNumber(trimmedOrgNumber) : null),
        [isB2BSelected, trimmedOrgNumber],
    );
    const normalizedOrgNumber = orgNumberValidation?.normalized ?? normalizeSwedishOrgNumber(trimmedOrgNumber);
    const trimmedInvoiceEmail = form.invoiceEmail.trim();
    const pricingTier = extractUserPricingTier(authProfile);
    const hasTierPricing = pricingTier !== 'DEFAULT';
    const isApplyingCoupon = couponStatus === 'loading';
    const requiresCompanyLogin = isB2BSelected && !isAuthenticated;
    const canSubmit =
        hasItems
        && !submitting
        && !isApplyingCoupon
        && !totalsRefreshing
        && (!isAuthenticated || Boolean(orderEmail))
        && !requiresCompanyLogin
        && (!isB2BSelected || (Boolean(trimmedCompanyName) && Boolean(trimmedOrgNumber) && (orgNumberValidation?.isValid ?? false)));
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
    const summaryDiscount = totals.discount ?? 0;
    const summaryShipping = totals.shipping ?? 0;
    const summaryTotals = useMemo(() => resolveTotalsBreakdown(totals), [totals]);
    const summaryTax = summaryTotals.vat;
    const summaryNet = summaryTotals.net;
    const displayedSummaryTotal = displayPrice(summaryNet, vatRate, priceDisplayMode);
    const displayedSummaryNet = summaryNet;
    const displayedSummaryShipping = displayPrice(summaryShipping, vatRate, priceDisplayMode);
    const displayedSummaryDiscount = displayPrice(summaryDiscount, vatRate, priceDisplayMode);
    const displayedSummaryTax = summaryTax;
    const displayedSummaryGross = displayPrice(summaryNet, vatRate, "INKL_MOMS");
    const priceModeSuffix = getPriceDisplaySuffix(priceDisplayMode);
    const showVatRow = true;
    const showVatInvoiceHint = isB2B && summaryTax <= 0;
    const ctaLabel = paymentMode === 'INVOICE_PAY_LATER'
        ? `Place order & receive invoice – ${formatCurrency(displayedSummaryTotal, quoteCurrency)}`
        : `Proceed to payment – ${formatCurrency(displayedSummaryTotal, quoteCurrency)}`;

    const invoiceOption = useMemo(() => {
        const invoiceDetails = activeCart?.invoice ?? activeCart?.checkout?.invoice ?? {};
        const flag = activeCart?.invoicePayLaterEligible ?? activeCart?.canPayByInvoice ?? invoiceDetails?.eligible;
        const backendReason = activeCart?.invoicePayLaterMessage ?? activeCart?.invoiceEligibilityMessage ?? invoiceDetails?.message;
        const enabled = typeof flag === 'boolean' ? flag : isB2B;
        return {
            enabled,
            reason: enabled ? '' : (backendReason || 'Invoice payment is only available for approved business customers.'),
        };
    }, [activeCart, isB2B]);

    useEffect(() => {
        if (paymentMode === 'INVOICE_PAY_LATER' && !invoiceOption.enabled) {
            setPaymentMode('PAY_NOW');
        }
    }, [invoiceOption.enabled, paymentMode]);


    useEffect(() => {
        if (!hasBusinessAccount) return;
        setForm((prev) => (prev.customerType === 'B2B' ? prev : { ...prev, customerType: 'B2B' }));
    }, [hasBusinessAccount]);

    useEffect(() => {
        setForm((prev) => (prev.customerType === customerType ? prev : { ...prev, customerType }));
    }, [customerType]);


    const applyAddressToForm = useCallback((address) => {
        if (!address) return;
        setForm((prev) => ({
            ...prev,
            fullName: prev.fullName || address.fullName,
            phone: prev.phone || address.phone,
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

        if (name === 'customerType') {
            setCustomerType(value, { persistProfile: isAuthenticated });
            return;
        }

        if (['companyName', 'orgNumber', 'vatNumber', 'invoiceEmail'].includes(name)) {
            setCompanyProfile({ [name]: value }, { persistProfile: false });
        }
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
        if (isB2BSelected && (!trimmedCompanyName || !trimmedOrgNumber)) {
            setError('Company name and org number are required for company checkout.');
            setSubmitting(false);
            checkoutInFlight.current = false;
            return;
        }
        if (requiresCompanyLogin) {
            setError('Please log in to buy as a company.');
            setSubmitting(false);
            checkoutInFlight.current = false;
            return;
        }
        if (isB2BSelected && !(orgNumberValidation?.isValid)) {
            setError(orgNumberValidation?.message || 'Please enter a valid organization number.');
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
            const company = isB2BSelected
                ? {
                    companyName: trimmedCompanyName,
                    orgNumber: normalizedOrgNumber || trimmedOrgNumber,
                    vatNumber: form.vatNumber.trim() || undefined,
                    invoiceEmail: trimmedInvoiceEmail || orderEmail,
                }
                : undefined;

            await setCustomerType(isB2BSelected ? 'B2B' : 'B2C', {
                persistProfile: isAuthenticated,
                companyProfile: company,
            });
            if (company) {
                await setCompanyProfile(company, { persistProfile: isAuthenticated });
            }

            if (paymentMode === 'INVOICE_PAY_LATER') {
                notify('info', 'Placing invoice order…');
                setStatusMessage('Submitting invoice order…');
                const response = await checkoutCart(cartId, {
                    cartId,
                    sessionId,
                    email: orderEmail,
                    shippingAddress,
                    couponCode: hasTierPricing ? undefined : (appliedCouponCode || undefined),
                    customerType: isB2BSelected ? 'B2B' : 'B2C',
                    company,
                    paymentMode: 'INVOICE_PAY_LATER',
                });
                const responseOrder = response?.order ?? response;
                const orderId = response?.orderId ?? responseOrder?.id ?? responseOrder?.orderId;
                if (!orderId) {
                    throw new Error('Invoice checkout did not return an order ID.');
                }
                const params = new URLSearchParams({
                    order_id: String(orderId),
                    payment_mode: 'INVOICE_PAY_LATER',
                });
                const invoiceNumber = responseOrder?.invoiceNumber ?? responseOrder?.invoice?.number;
                const dueDate = responseOrder?.invoiceDueDate ?? responseOrder?.invoice?.dueDate;
                if (invoiceNumber) params.set('invoice_number', String(invoiceNumber));
                if (dueDate) params.set('invoice_due_date', String(dueDate));
                notify('success', 'Order placed. Invoice issued.');
                navigate(`/store/checkout/success?${params.toString()}`);
                return;
            }

            notify('info', 'Starting Stripe Checkout…');
            setStatusMessage('Requesting Stripe Checkout…');

            const response = await createStripeCheckoutSession(token, {
                // Keep coupon optional; tier pricing is resolved server-side without coupon dependency.
                cartId,
                sessionId,
                email: orderEmail,
                shippingAddress,
                couponCode: hasTierPricing ? undefined : (appliedCouponCode || undefined),
                customerType: isB2BSelected ? 'B2B' : 'B2C',
                company,
                paymentMode: 'PAY_NOW',
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

    const handleCompanyLoginRedirect = () => {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        redirectToLogin(returnTo);
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
                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Contact</h2>
                            {isAuthenticated ? (
                                <div className={styles.accountNote}>
                                    <span>Signed in as {profileEmail || 'your account'}</span>
                                    <button type="button" className={styles.logoutLink} onClick={() => logout({ redirect: false })}>
                                        Log out
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.guestIntro}>
                                    <h3 className={styles.guestTitle}>Checkout as guest</h3>
                                    <p className={styles.guestSubtitle}>
                                        No account needed. Enter your email to receive order updates.
                                    </p>
                                    <Link className={styles.guestLink} to="/login?next=/store/checkout">
                                        Have an account? Log in
                                    </Link>
                                </div>
                            )}
                            <div className={styles.fieldGroup}>
                                <label htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    value={orderEmail}
                                    onChange={handleChange}
                                    readOnly={isAuthenticated}
                                />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label htmlFor="fullName">Full name</label>
                                <input id="fullName" name="fullName" type="text" required value={form.fullName} onChange={handleChange} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label htmlFor="phone">Phone</label>
                                <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label>Purchase type</label>
                                <fieldset className={styles.customerTypeFieldset}>
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
                                        Company / Restaurant (B2B)
                                    </label>
                                </fieldset>
                                {requiresCompanyLogin ? (
                                    <div className={styles.companyLoginPrompt} role="status">
                                        <p>Please log in to buy as a company.</p>
                                        <button type="button" className={styles.guestLink} onClick={handleCompanyLoginRedirect}>
                                            Log in and continue
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </section>

                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Delivery</h2>
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
                                        <label htmlFor="country">Country (ISO code)</label>
                                        <input
                                            id="country"
                                            name="country"
                                            type="text"
                                            required
                                            maxLength={2}
                                            value={form.country}
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
                        </section>

                        {isB2B ? (
                            <section className={`${styles.card} ${styles.companyPanel}`}>
                                <h2 className={styles.cardTitle}>Business purchase</h2>
                                <div className={styles.infoBox}>
                                    <p>Company invoice details will be included on your invoice.</p>
                                    <p className={styles.mutedInfo}>Please make sure company data and invoice email are correct before placing your order.</p>
                                </div>
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
                                    <label htmlFor="orgNumber">Organization number</label>
                                    <input
                                        id="orgNumber"
                                        name="orgNumber"
                                        type="text"
                                        required={isB2B}
                                        value={form.orgNumber}
                                        inputMode="numeric"
                                        placeholder="556677-8899"
                                        onChange={handleChange}
                                    />
                                    {isB2BSelected && trimmedOrgNumber && !(orgNumberValidation?.isValid) ? (
                                        <p className={styles.error} role="alert">
                                            {orgNumberValidation?.message}
                                        </p>
                                    ) : null}
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
                                <div className={styles.divider} />
                                <h3 className={styles.subsectionTitle}>Payment timing</h3>
                                <fieldset className={styles.customerTypeFieldset}>
                                    <label className={styles.radioOption}>
                                        <input
                                            type="radio"
                                            name="paymentMode"
                                            value="PAY_NOW"
                                            checked={paymentMode === 'PAY_NOW'}
                                            onChange={() => setPaymentMode('PAY_NOW')}
                                        />
                                        Pay now
                                    </label>
                                    <label className={styles.radioOption}>
                                        <input
                                            type="radio"
                                            name="paymentMode"
                                            value="INVOICE_PAY_LATER"
                                            checked={paymentMode === 'INVOICE_PAY_LATER'}
                                            onChange={() => setPaymentMode('INVOICE_PAY_LATER')}
                                            disabled={!invoiceOption.enabled}
                                        />
                                        Invoice (pay later)
                                    </label>
                                </fieldset>
                                {paymentMode === 'INVOICE_PAY_LATER' ? (
                                    <div className={styles.infoBox}>
                                        <p>You&apos;ll receive an invoice and pay later.</p>
                                        <p>Only for approved business customers.</p>
                                        <p className={styles.mutedInfo}>Typical terms: 14 days.</p>
                                    </div>
                                ) : null}
                                {!invoiceOption.enabled ? <p className={styles.error}>{invoiceOption.reason}</p> : null}
                            </section>
                        ) : null}

                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Coupon</h2>
                            {hasTierPricing ? (
                                <span className={styles.badge}>Supporter price applied</span>
                            ) : (
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
                            )}
                        </section>

                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Notes</h2>
                            <div className={styles.fieldGroup}>
                                <label htmlFor="notes">Notes</label>
                                <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows={3} />
                            </div>
                        </section>
                        {error ? <p className={styles.error}>{error}</p> : null}
                        {statusMessage ? <p className={styles.status}>{statusMessage}</p> : null}
                        <button type="submit" className={`${styles.submit} ${styles.stickyCta}`} disabled={!canSubmit || loadingProfile}>
                            {submitting ? (
                                <span className={styles.submitContent}>
                                    <span className={styles.spinner} aria-hidden="true" />
                                    <span>{paymentMode === 'INVOICE_PAY_LATER' ? 'Placing invoice order…' : 'Starting checkout…'}</span>
                                </span>
                            ) : (
                                ctaLabel
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
                                            {formatCurrency(displayPrice(item.discountedUnitPrice ?? item.price ?? item.unitPrice ?? 0, vatRate, priceDisplayMode), currency)}
                                        </p>
                                    </div>
                                    <span>
                                        {formatCurrency(
                                            item.discountedLineTotal !== undefined && item.discountedLineTotal !== null
                                                ? displayPrice(item.discountedLineTotal, vatRate, priceDisplayMode)
                                                : item.total !== undefined && item.total !== null
                                                    ? displayPrice(item.total, vatRate, priceDisplayMode)
                                                    : item.lineTotal !== undefined && item.lineTotal !== null
                                                        ? displayPrice(item.lineTotal, vatRate, priceDisplayMode)
                                                        : displayLineTotal(
                                                            item.discountedUnitPrice ?? item.price ?? item.unitPrice ?? 0,
                                                            item.quantity ?? item.qty ?? 1,
                                                            vatRate,
                                                            priceDisplayMode,
                                                        ),
                                            currency,
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className={styles.mutedInfo}>
                            Price mode: {priceModeSuffix}.
                        </p>
                        <div className={styles.row}>
                            <span>Net subtotal (excl. VAT)</span>
                            <span>{formatCurrency(displayedSummaryNet, quoteCurrency)}</span>
                        </div>
                        {summaryDiscount > 0 ? (
                            <div className={styles.row}>
                                <span>{hasTierPricing ? 'You saved' : 'Discount'}</span>
                                <span>-{formatCurrency(displayedSummaryDiscount, quoteCurrency)}</span>
                            </div>
                        ) : null}
                        <div className={styles.row}>
                            <span>Shipping/Pickup fee</span>
                            <span>{formatCurrency(displayedSummaryShipping, quoteCurrency)}</span>
                        </div>
                        {showVatRow ? (
                            <div className={styles.row}>
                                <span>
                                    VAT
                                    {showVatInvoiceHint ? <span className={styles.mutedInfo}> · VAT will be calculated on invoice</span> : null}
                                </span>
                                <span>{formatCurrency(displayedSummaryTax, quoteCurrency)}</span>
                            </div>
                        ) : null}
                        <div className={styles.row}>
                            <span>Gross total (incl. VAT)</span>
                            <span>{formatCurrency(displayedSummaryGross, quoteCurrency)}</span>
                        </div>
                        <div className={styles.pickupNote}>
                            {paymentMode === 'INVOICE_PAY_LATER'
                                ? 'Pickup confirmation is shared by email with your invoice details.'
                                : 'Pickup confirmed after payment. We\'ll email the details.'}
                        </div>
                        <div className={styles.divider} />
                        <div className={`${styles.row} ${styles.total}`}>
                            <span>
                                {isB2B && priceDisplayMode === 'EXKL_MOMS'
                                    ? `Att betala (exkl. moms · ${currencyLabel(quoteCurrency)})`
                                    : `Att betala (inkl. moms · ${currencyLabel(quoteCurrency)})`}
                            </span>
                            <span>{formatCurrency(displayedSummaryTotal, quoteCurrency)}</span>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
