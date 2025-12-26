import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { updateCustomerProfile } from '../../api/customer.js';
import { useAuth } from '../../context/AuthContext.jsx';
import styles from './CustomerSettings.module.css';

const defaultNotifications = {
    orderEmails: true,
    pickupReady: true,
};

const RESET_COOLDOWN_MS = 8000;
const API_BASE =
    import.meta?.env?.VITE_API_BASE ||
    import.meta?.env?.VITE_API_URL ||
    'https://api.hydroleaf.se';

const getNotificationDefaults = (raw = {}) => ({
    orderEmails: raw.orderEmails ?? raw.orderConfirmationEmails ?? defaultNotifications.orderEmails,
    pickupReady: raw.pickupReady ?? raw.pickupReadyNotification ?? defaultNotifications.pickupReady,
});

const areNotificationsEqual = (a, b) => a.orderEmails === b.orderEmails && a.pickupReady === b.pickupReady;

export default function CustomerSettings() {
    const { profile, loadingProfile, redirectToLogin, refreshProfile } = useOutletContext();
    const { token } = useAuth();
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
    const [resetState, setResetState] = useState({ status: 'idle', message: '' });
    const [resetError, setResetError] = useState('');
    const [resetCooldown, setResetCooldown] = useState(false);
    const resetTimerRef = useRef(null);

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
        return () => {
            if (resetTimerRef.current) {
                window.clearTimeout(resetTimerRef.current);
            }
        };
    }, []);

    const clearSaveFeedback = () => {
        if (saveState.status !== 'idle' || saveError) {
            setSaveState({ status: 'idle', message: '' });
            setSaveError('');
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

    const handlePasswordReset = async () => {
        if (resetState.status === 'sending' || resetCooldown) return;
        setResetState({ status: 'sending', message: '' });
        setResetError('');
        try {
            const res = await fetch(`${API_BASE}/api/auth/password-reset`, {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) {
                let errorMessage = 'Could not start password reset. Please try again.';
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const body = await res.json().catch(() => null);
                    if (body?.message) {
                        errorMessage = body.message;
                    }
                }
                setResetState({ status: 'error', message: '' });
                setResetError(errorMessage);
                return;
            }
            setResetState({ status: 'sent', message: 'Reset link sent to your email' });
            setResetCooldown(true);
            resetTimerRef.current = window.setTimeout(() => {
                setResetCooldown(false);
            }, RESET_COOLDOWN_MS);
        } catch (error) {
            setResetState({ status: 'error', message: '' });
            setResetError(error?.message || 'Unable to send reset link.');
        }
    };

    const isSaving = saveState.status === 'saving';
    const canSave = isDirty && !isSaving && profileUpdateSupported;
    const resetDisabled = resetState.status === 'sending' || resetCooldown;

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
