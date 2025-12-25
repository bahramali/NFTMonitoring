import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import styles from './CustomerSettings.module.css';

const defaultNotifications = {
    orderEmails: true,
    pickupReady: true,
};

export default function CustomerSettings() {
    const { profile, loadingProfile } = useOutletContext();
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [touchedFields, setTouchedFields] = useState({ fullName: false, phoneNumber: false });
    const [notifications, setNotifications] = useState(defaultNotifications);

    useEffect(() => {
        if (!profile) return;
        setEmail(profile.email || '');
        if (!touchedFields.fullName) {
            setFullName(profile.displayName || '');
        }
    }, [profile, touchedFields.fullName]);

    const handleToggle = (key) => {
        setNotifications((previous) => ({ ...previous, [key]: !previous[key] }));
    };

    const emailDisplay = useMemo(() => {
        if (loadingProfile) return 'Loading…';
        return email || '—';
    }, [email, loadingProfile]);

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
                                setFullName(event.target.value);
                                setTouchedFields((previous) => ({ ...previous, fullName: true }));
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
                                setPhoneNumber(event.target.value);
                                setTouchedFields((previous) => ({ ...previous, phoneNumber: true }));
                            }}
                            className={styles.input}
                        />
                        <p className={styles.helper}>Used for pickup ready notifications.</p>
                    </div>
                    <div className={styles.field}>
                        <label>Email address</label>
                        <div className={styles.readonly}>{emailDisplay}</div>
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
                    <button type="button" className={styles.primaryButton}>
                        Change password
                    </button>
                </div>
            </section>
        </div>
    );
}
