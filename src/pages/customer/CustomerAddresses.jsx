import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
    createCustomerAddress,
    deleteCustomerAddress,
    fetchCustomerAddresses,
    setDefaultCustomerAddress,
    updateCustomerAddress,
} from '../../api/customerAddresses.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractAddressList, formatAddressLine, normalizeAddress } from './addressUtils.js';
import styles from './CustomerAddresses.module.css';

const emptyForm = {
    label: '',
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'SE',
    phone: '',
};

const toBackendPayload = (values) => ({
    label: values.label?.trim() || null,
    fullName: values.fullName?.trim() || null,
    street1: values.line1?.trim() || '',
    street2: values.line2?.trim() || null,
    postalCode: values.postalCode?.trim() || '',
    city: values.city?.trim() || '',
    region: values.state?.trim() || null,
    countryCode: (values.country || '').trim().length === 2 ? values.country.trim().toUpperCase() : '',
    phoneNumber: values.phone?.trim() || null,
});

export default function CustomerAddresses() {
    const { token } = useAuth();
    const { redirectToLogin } = useOutletContext();
    const [addressesState, setAddressesState] = useState({ loading: false, error: null, items: [] });
    const [formState, setFormState] = useState({ mode: 'idle', values: emptyForm, error: '', saving: false });

    const loadAddresses = useCallback(() => {
        if (!token) return;
        setAddressesState((prev) => ({ ...prev, loading: true, error: null }));
        fetchCustomerAddresses(token, { onUnauthorized: redirectToLogin })
            .then((payload) => {
                if (payload === null) return;
                const list = extractAddressList(payload).map(normalizeAddress);
                setAddressesState({ loading: false, error: null, items: list });
            })
            .catch((error) => {
                if (error?.isUnsupported) {
                    setAddressesState({ loading: false, error: 'Address book is not enabled yet.', items: [] });
                    return;
                }
                setAddressesState({ loading: false, error: error?.message || 'Failed to load addresses', items: [] });
            });
    }, [redirectToLogin, token]);

    useEffect(() => {
        loadAddresses();
    }, [loadAddresses]);

    const startAdd = () => {
        setFormState({ mode: 'create', values: emptyForm, error: '', saving: false });
    };

    const startEdit = (address) => {
        setFormState({
            mode: 'edit',
            values: {
                label: address.label || '',
                fullName: address.fullName || '',
                line1: address.line1 || '',
                line2: address.line2 || '',
                city: address.city || '',
                state: address.state || '',
                postalCode: address.postalCode || '',
                country: address.country || 'SE',
                phone: address.phone || '',
            },
            error: '',
            saving: false,
            id: address.id,
        });
    };

    const cancelForm = () => {
        setFormState({ mode: 'idle', values: emptyForm, error: '', saving: false });
    };

    const handleChange = (field, value) => {
        setFormState((prev) => ({
            ...prev,
            values: { ...prev.values, [field]: value },
            error: '',
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!token) return;
        setFormState((prev) => ({ ...prev, saving: true, error: '' }));
        const payload = toBackendPayload(formState.values);
        try {
            if (formState.mode === 'edit') {
                await updateCustomerAddress(token, formState.id, payload, { onUnauthorized: redirectToLogin });
            } else {
                await createCustomerAddress(token, payload, { onUnauthorized: redirectToLogin });
            }
            cancelForm();
            loadAddresses();
        } catch (error) {
            if (error?.isUnsupported) {
                setFormState((prev) => ({
                    ...prev,
                    saving: false,
                    error: 'Address updates are not enabled yet.',
                }));
                return;
            }
            setFormState((prev) => ({
                ...prev,
                saving: false,
                error: error?.message || 'Unable to save address.',
            }));
        }
    };

    const handleDelete = async (addressId) => {
        if (!token || !addressId) return;
        const confirmed = window.confirm('Delete this address?');
        if (!confirmed) return;
        try {
            await deleteCustomerAddress(token, addressId, { onUnauthorized: redirectToLogin });
            loadAddresses();
        } catch (error) {
            setAddressesState((prev) => ({
                ...prev,
                error: error?.message || 'Unable to delete address.',
            }));
        }
    };

    const handleSetDefault = async (addressId) => {
        if (!token || !addressId) return;
        try {
            await setDefaultCustomerAddress(token, addressId, { onUnauthorized: redirectToLogin });
            loadAddresses();
        } catch (error) {
            setAddressesState((prev) => ({
                ...prev,
                error: error?.message || 'Unable to update the default address.',
            }));
        }
    };

    const defaultAddress = useMemo(
        () => addressesState.items.find((address) => address.isDefault),
        [addressesState.items],
    );

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <p className={styles.kicker}>Addresses</p>
                    <h2>Saved addresses</h2>
                    <p className={styles.subtitle}>Add multiple addresses for quick checkout.</p>
                </div>
                <div className={styles.headerActions}>
                    <button type="button" className={styles.primaryButton} onClick={startAdd}>
                        Add address
                    </button>
                    <Link to="/my-page" className={styles.secondaryButton}>
                        Back to overview
                    </Link>
                </div>
            </div>

            {addressesState.loading ? <p className={styles.loading}>Loading addresses…</p> : null}
            {addressesState.error ? (
                <p className={styles.error} role="alert">
                    {addressesState.error}
                </p>
            ) : null}

            {formState.mode !== 'idle' ? (
                <form className={styles.formCard} onSubmit={handleSubmit}>
                    <div className={styles.formHeader}>
                        <div>
                            <h3>{formState.mode === 'edit' ? 'Edit address' : 'New address'}</h3>
                            <p className={styles.helper}>Fill in the details exactly as they should appear.</p>
                        </div>
                        <button type="button" className={styles.textButton} onClick={cancelForm}>
                            Cancel
                        </button>
                    </div>

                    <div className={styles.formGrid}>
                        <div className={styles.field}>
                            <label htmlFor="address-label">Label</label>
                            <input
                                id="address-label"
                                type="text"
                                value={formState.values.label}
                                onChange={(event) => handleChange('label', event.target.value)}
                                placeholder="Home, Office"
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="address-name">Full name</label>
                            <input
                                id="address-name"
                                type="text"
                                value={formState.values.fullName}
                                onChange={(event) => handleChange('fullName', event.target.value)}
                                placeholder="Full name"
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="address-line1">Address line 1</label>
                            <input
                                id="address-line1"
                                type="text"
                                value={formState.values.line1}
                                onChange={(event) => handleChange('line1', event.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="address-line2">Address line 2</label>
                            <input
                                id="address-line2"
                                type="text"
                                value={formState.values.line2}
                                onChange={(event) => handleChange('line2', event.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="address-city">City</label>
                            <input
                                id="address-city"
                                type="text"
                                value={formState.values.city}
                                onChange={(event) => handleChange('city', event.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="address-state">State / Region</label>
                            <input
                                id="address-state"
                                type="text"
                                value={formState.values.state}
                                onChange={(event) => handleChange('state', event.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="address-postal">Postal code</label>
                            <input
                                id="address-postal"
                                type="text"
                                value={formState.values.postalCode}
                                onChange={(event) => handleChange('postalCode', event.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="address-country">Country code (ISO-2)</label>
                            <select
                                id="address-country"
                                value={formState.values.country}
                                onChange={(event) => handleChange('country', event.target.value)}
                                required
                            >
                                <option value="SE">SE</option>
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="address-phone">Phone</label>
                            <input
                                id="address-phone"
                                type="tel"
                                value={formState.values.phone}
                                onChange={(event) => handleChange('phone', event.target.value)}
                            />
                        </div>
                    </div>

                    {formState.error ? <p className={styles.error}>{formState.error}</p> : null}

                    <div className={styles.formActions}>
                        <button type="submit" className={styles.primaryButton} disabled={formState.saving}>
                            {formState.saving ? 'Saving…' : 'Save address'}
                        </button>
                        <button type="button" className={styles.secondaryButton} onClick={cancelForm}>
                            Cancel
                        </button>
                    </div>
                </form>
            ) : null}

            {!addressesState.loading && addressesState.items.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No addresses saved yet.</p>
                    <button type="button" className={styles.primaryButton} onClick={startAdd}>
                        Add your first address
                    </button>
                </div>
            ) : null}

            <div className={styles.list}>
                {addressesState.items.map((address) => (
                    <div key={address.id || address.line1} className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <p className={styles.cardTitle}>
                                    {address.label || address.fullName || 'Saved address'}
                                </p>
                                <p className={styles.cardSubtitle}>{formatAddressLine(address) || '—'}</p>
                            </div>
                            {address.isDefault ? <span className={styles.badge}>Default</span> : null}
                        </div>
                        {address.phone ? <p className={styles.cardMeta}>Phone: {address.phone}</p> : null}
                        <div className={styles.cardActions}>
                            <button type="button" className={styles.textButton} onClick={() => startEdit(address)}>
                                Edit
                            </button>
                            <button type="button" className={styles.textButton} onClick={() => handleDelete(address.id)}>
                                Delete
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => handleSetDefault(address.id)}
                                disabled={address.isDefault}
                            >
                                {address.isDefault ? 'Default' : 'Set default'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {defaultAddress ? (
                <p className={styles.helper}>Default address: {formatAddressLine(defaultAddress)}</p>
            ) : null}
        </div>
    );
}
