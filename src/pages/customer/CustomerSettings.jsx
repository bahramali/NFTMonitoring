import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { updateCustomerProfile } from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePricingDisplay } from '../../context/PricingDisplayContext.jsx';
import usePasswordReset from '../../hooks/usePasswordReset.js';
import { normalizeSwedishOrgNumber, validateSwedishOrgNumber } from '../../utils/swedishOrgNumber.js';
import styles from './CustomerSettings.module.css';

const defaultNotifications = {
    orderEmails: true,
    pickupReady: true,
};

const getNotificationDefaults = (raw = {}) => ({
    orderEmails: raw.orderEmails ?? raw.orderConfirmationEmails ?? defaultNotifications.orderEmails,
    pickupReady: raw.pickupReady ?? raw.pickupReadyNotification ?? defaultNotifications.pickupReady,
});

const areNotificationsEqual = (a, b) => a.orderEmails === b.orderEmails && a.pickupReady === b.pickupReady;

export default function CustomerSettings() {
    const { profile, loadingProfile, redirectToLogin, refreshProfile } = useOutletContext();
    const { token } = useAuth();
    const {
        customerType,
        companyProfile,
        setCustomerType,
        setCompanyProfile,
        refreshPricingProfile,
    } = usePricingDisplay();
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [notifications, setNotifications] = useState(defaultNotifications);
    const [initialSettings, setInitialSettings] = useState({
        fullName: '',
        phoneNumber: '',
        notifications: defaultNotifications,
    });
    const [saveState, setSaveState] = useState({ status: 'idle', message: '' });
    const [saveError, setSaveError] = useState('');
    const [profileUpdateSupported, setProfileUpdateSupported] = useState(true);
    const [profileUpdateMessage, setProfileUpdateMessage] = useState(
        'Profile updates are not available yet. Please contact support for help.',
    );
    const [companyType, setCompanyType] = useState('B2C');
    const [companyName, setCompanyName] = useState('');
    const [orgNumber, setOrgNumber] = useState('');
    const [vatNumber, setVatNumber] = useState('');
    const [invoiceEmail, setInvoiceEmail] = useState('');
    const [companySaveState, setCompanySaveState] = useState({ status: 'idle', message: '' });
    const [companySaveError, setCompanySaveError] = useState('');
    const { resetState, resetError, resetDisabled, handlePasswordReset } = usePasswordReset({ token });

    useEffect(() => {
        if (!profile) return;
        setEmail(profile.email || '');
        const raw = profile.raw ?? {};
        const nextSettings = {
            fullName: raw.fullName ?? raw.name ?? profile.displayName ?? '',
            phoneNumber: raw.phoneNumber ?? raw.phone ?? '',
            notifications: getNotificationDefaults(
                raw.notifications ?? raw.notificationPreferences ?? raw.preferences?.notifications ?? {},
            ),
        };
        setInitialSettings(nextSettings);
        setFullName(nextSettings.fullName);
        setPhoneNumber(nextSettings.phoneNumber);
        setNotifications(nextSettings.notifications);
        setSaveState({ status: 'idle', message: '' });
        setSaveError('');
    }, [profile]);

    useEffect(() => {
        setCompanyType(customerType === 'B2B' ? 'B2B' : 'B2C');
    }, [customerType]);

    useEffect(() => {
        setCompanyName(companyProfile?.companyName ?? '');
        setOrgNumber(companyProfile?.orgNumber ?? '');
        setVatNumber(companyProfile?.vatNumber ?? '');
        setInvoiceEmail(companyProfile?.invoiceEmail ?? profile?.email ?? '');
    }, [companyProfile, profile?.email]);

    const clearSaveFeedback = () => {
        if (saveState.status !== 'idle' || saveError) {
            setSaveState({ status: 'idle', message: '' });
            setSaveError('');
        }
    };

    const clearCompanyFeedback = () => {
        if (companySaveState.status !== 'idle' || companySaveError) {
            setCompanySaveState({ status: 'idle', message: '' });
            setCompanySaveError('');
        }
    };

    const handleToggle = (key) => {
        clearSaveFeedback();
        setNotifications((previous) => ({ ...previous, [key]: !previous[key] }));
    };

    const isDirty = useMemo(() => {
        const nameChanged = fullName !== initialSettings.fullName;
        const phoneChanged = phoneNumber !== initialSettings.phoneNumber;
        const notificationsChanged = !areNotificationsEqual(notifications, initialSettings.notifications);
        return nameChanged || phoneChanged || notificationsChanged;
    }, [fullName, initialSettings, notifications, phoneNumber]);

    const emailDisplay = useMemo(() => {
        if (loadingProfile) return 'Loading…';
        return email || '—';
    }, [email, loadingProfile]);

    const normalizedOrg = useMemo(() => normalizeSwedishOrgNumber(orgNumber), [orgNumber]);
    const orgValidation = useMemo(
        () => (companyType === 'B2B' && orgNumber.trim() ? validateSwedishOrgNumber(orgNumber) : null),
        [companyType, orgNumber],
    );
    const isCompanyDirty = useMemo(() => {
        const profileType = customerType === 'B2B' ? 'B2B' : 'B2C';
        if (companyType !== profileType) return true;
        return (
            companyName !== (companyProfile?.companyName ?? '')
            || orgNumber !== (companyProfile?.orgNumber ?? '')
            || vatNumber !== (companyProfile?.vatNumber ?? '')
            || invoiceEmail !== (companyProfile?.invoiceEmail ?? profile?.email ?? '')
        );
    }, [companyName, companyProfile, companyType, customerType, invoiceEmail, orgNumber, profile?.email, vatNumber]);

    const handleSave = async () => {
        if (!profileUpdateSupported) {
            setSaveError(profileUpdateMessage);
            return;
        }
        if (!token) {
            setSaveError('You must be logged in to update your settings.');
            return;
        }
        setSaveState({ status: 'saving', message: 'Saving…' });
        setSaveError('');
        try {
            const payload = {
                fullName,
                phoneNumber,
                orderConfirmationEmails: notifications.orderEmails,
                pickupReadyNotification: notifications.pickupReady,
            };
            const response = await updateCustomerProfile(token, payload, { onUnauthorized: redirectToLogin });
            if (response === null) {
                return;
            }
            const responseData = response?.user ?? response;
            if (responseData && typeof responseData === 'object') {
                const raw = responseData?.raw ?? responseData ?? {};
                const updatedSettings = {
                    fullName: raw.fullName ?? raw.name ?? fullName,
                    phoneNumber: raw.phoneNumber ?? raw.phone ?? phoneNumber,
                    notifications: getNotificationDefaults(
                        raw.notifications ?? raw.notificationPreferences ?? raw.preferences?.notifications ?? {},
                    ),
                };
                setEmail(responseData?.email ?? responseData?.username ?? email);
                setInitialSettings(updatedSettings);
                setFullName(updatedSettings.fullName);
                setPhoneNumber(updatedSettings.phoneNumber);
                setNotifications(updatedSettings.notifications);
            } else {
                await refreshProfile?.();
            }
            setSaveState({ status: 'success', message: 'Saved' });
        } catch (error) {
            if (error?.isUnsupported) {
                setProfileUpdateSupported(false);
                setProfileUpdateMessage(
                    error?.message || 'Profile updates are not available yet. Please contact support for help.',
                );
                setSaveState({ status: 'error', message: '' });
                setSaveError(
                    error?.message || 'Profile updates are not available yet. Please contact support for help.',
                );
                return;
            }
            setSaveState({ status: 'error', message: '' });
            setSaveError(error?.message || 'Unable to save changes.');
        }
    };

    const handleCompanySave = async () => {
        clearCompanyFeedback();
        if (!token) {
            setCompanySaveError('Please log in to upgrade your account to company pricing.');
            return;
        }

        if (companyType === 'B2B') {
            if (!companyName.trim() || !orgNumber.trim()) {
                setCompanySaveError('Company name and organization number are required for B2B mode.');
                return;
            }
            if (!(orgValidation?.isValid)) {
                setCompanySaveError(orgValidation?.message || 'Please enter a valid Swedish organization number.');
                return;
            }
        }

        setCompanySaveState({ status: 'saving', message: 'Saving company profile…' });
        try {
            const payload = companyType === 'B2B'
                ? {
                    companyName: companyName.trim(),
                    orgNumber: normalizedOrg,
                    vatNumber: vatNumber.trim() || '',
                    invoiceEmail: invoiceEmail.trim() || email || '',
                }
                : {
                    companyName: '',
                    orgNumber: '',
                    vatNumber: '',
                    invoiceEmail: '',
                };

            await updateCustomerProfile(token, payload, { onUnauthorized: redirectToLogin });
            await setCustomerType(companyType, { persistProfile: false, companyProfile: payload });
            await setCompanyProfile(payload, { persistProfile: false });
            await refreshPricingProfile();
            await refreshProfile?.();
            setCompanySaveState({ status: 'success', message: 'Company profile saved.' });
        } catch (error) {
            setCompanySaveState({ status: 'error', message: '' });
            setCompanySaveError(error?.message || 'Unable to save company profile.');
        }
    };

    const isSaving = saveState.status === 'saving';
    const canSave = isDirty && !isSaving && profileUpdateSupported;
    const isSavingCompany = companySaveState.status === 'saving';
    const canSaveCompany = isCompanyDirty && !isSavingCompany;

    return (
        <div className={styles.grid}>
            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Profile & Contact</p>
                        <h2>Contact details</h2>
                        <p className={styles.muted}>Keep checkout and pickup messages accurate.</p>
                    </div>
                </div>

                <div className={styles.formGrid}>
                    <div className={styles.field}>
                        <label htmlFor="full-name">Full name</label>
                        <input
                            id="full-name"
                            type="text"
                            value={fullName}
                            placeholder="Add your full name"
                            onChange={(event) => {
                                clearSaveFeedback();
                                setFullName(event.target.value);
                            }}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="phone-number">Phone number</label>
                        <input
                            id="phone-number"
                            type="tel"
                            value={phoneNumber}
                            placeholder="Add a phone number"
                            onChange={(event) => {
                                clearSaveFeedback();
                                setPhoneNumber(event.target.value);
                            }}
                            className={styles.input}
                        />
                        <p className={styles.helper}>Used for pickup ready notifications.</p>
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="email">Email address</label>
                        <input
                            id="email"
                            type="email"
                            value={emailDisplay}
                            readOnly
                            className={styles.readonlyInput}
                        />
                        <p className={styles.helper}>Email changes require verification.</p>
                    </div>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Notifications</p>
                        <h2>Order updates</h2>
                        <p className={styles.muted}>Stay informed without extra noise.</p>
                    </div>
                </div>

                <div className={styles.toggleList}>
                    <div className={styles.toggleRow}>
                        <div>
                            <p className={styles.toggleTitle}>Order confirmation emails</p>
                            <p className={styles.helper}>Receipt and order summary messages.</p>
                        </div>
                        <label className={styles.switch}>
                            <input
                                type="checkbox"
                                checked={notifications.orderEmails}
                                onChange={() => handleToggle('orderEmails')}
                            />
                        </label>
                    </div>
                    <div className={styles.toggleRow}>
                        <div>
                            <p className={styles.toggleTitle}>Pickup ready notification</p>
                            <p className={styles.helper}>Let me know when my order is ready.</p>
                        </div>
                        <label className={styles.switch}>
                            <input
                                type="checkbox"
                                checked={notifications.pickupReady}
                                onChange={() => handleToggle('pickupReady')}
                            />
                        </label>
                    </div>
                    <div className={styles.actionRow}>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handleSave}
                            disabled={!canSave}
                        >
                            {isSaving ? 'Saving…' : 'Save changes'}
                        </button>
                        <div>
                            {saveState.status === 'success' ? (
                                <p className={styles.successMessage}>Saved</p>
                            ) : null}
                            {saveError ? <p className={styles.errorMessage}>{saveError}</p> : null}
                            {!profileUpdateSupported && !saveError ? (
                                <p className={styles.errorMessage}>{profileUpdateMessage}</p>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Company profile upgrade</p>
                        <h2>B2B pricing mode</h2>
                        <p className={styles.muted}>
                            {companyType === 'B2B'
                                ? 'Company mode: prices are shown exkl. moms.'
                                : 'Private mode: prices are shown inkl. moms.'}
                        </p>
                    </div>
                </div>
                <fieldset className={styles.customerTypeFieldset}>
                    <label className={styles.radioOption} htmlFor="settings-customer-b2c">
                        <input
                            id="settings-customer-b2c"
                            type="radio"
                            name="customer-settings-type"
                            value="B2C"
                            checked={companyType === 'B2C'}
                            onChange={() => {
                                clearCompanyFeedback();
                                setCompanyType('B2C');
                            }}
                        />
                        Private (inkl. moms)
                    </label>
                    <label className={styles.radioOption} htmlFor="settings-customer-b2b">
                        <input
                            id="settings-customer-b2b"
                            type="radio"
                            name="customer-settings-type"
                            value="B2B"
                            checked={companyType === 'B2B'}
                            onChange={() => {
                                clearCompanyFeedback();
                                setCompanyType('B2B');
                            }}
                        />
                        Company (exkl. moms)
                    </label>
                </fieldset>
                {companyType === 'B2B' ? (
                    <div className={styles.formGrid}>
                        <div className={styles.field}>
                            <label htmlFor="company-name">Company name</label>
                            <input
                                id="company-name"
                                type="text"
                                value={companyName}
                                onChange={(event) => {
                                    clearCompanyFeedback();
                                    setCompanyName(event.target.value);
                                }}
                                className={styles.input}
                                required
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="org-number">Organization number</label>
                            <input
                                id="org-number"
                                type="text"
                                value={orgNumber}
                                onChange={(event) => {
                                    clearCompanyFeedback();
                                    setOrgNumber(event.target.value);
                                }}
                                className={styles.input}
                                placeholder="556677-8899"
                                required
                            />
                            {orgNumber.trim() && !(orgValidation?.isValid) ? (
                                <p className={styles.errorMessage}>{orgValidation?.message}</p>
                            ) : null}
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="vat-number">VAT number (optional)</label>
                            <input
                                id="vat-number"
                                type="text"
                                value={vatNumber}
                                onChange={(event) => {
                                    clearCompanyFeedback();
                                    setVatNumber(event.target.value);
                                }}
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="invoice-email">Invoice email (optional)</label>
                            <input
                                id="invoice-email"
                                type="email"
                                value={invoiceEmail}
                                onChange={(event) => {
                                    clearCompanyFeedback();
                                    setInvoiceEmail(event.target.value);
                                }}
                                className={styles.input}
                                placeholder={email || 'name@company.se'}
                            />
                        </div>
                    </div>
                ) : null}
                <div className={styles.actionRow}>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleCompanySave}
                        disabled={!canSaveCompany}
                    >
                        {isSavingCompany ? 'Saving…' : 'Save company profile'}
                    </button>
                    <div>
                        {companySaveState.status === 'success' ? (
                            <p className={styles.successMessage}>{companySaveState.message}</p>
                        ) : null}
                        {companySaveError ? <p className={styles.errorMessage}>{companySaveError}</p> : null}
                    </div>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}>
                    <div>
                        <p className={styles.kicker}>Security</p>
                        <h2>Change password</h2>
                        <p className={styles.muted}>Keep your account secure with regular updates.</p>
                    </div>
                </div>

                <div className={styles.securityRow}>
                    <div>
                        <p className={styles.toggleTitle}>Update your password</p>
                        <p className={styles.helper}>We’ll send a reset link to your verified email.</p>
                    </div>
                    <div className={styles.actionStack}>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handlePasswordReset}
                            disabled={resetDisabled}
                        >
                            {resetState.status === 'sending' ? 'Sending…' : 'Change password'}
                        </button>
                        {resetState.status === 'sent' ? (
                            <p className={styles.successMessage}>{resetState.message}</p>
                        ) : null}
                        {resetError ? <p className={styles.errorMessage}>{resetError}</p> : null}
                    </div>
                </div>
            </section>
        </div>
    );
}
