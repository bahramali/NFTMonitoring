import React, { useEffect, useRef, useState } from 'react';
import styles from './LegalPage.module.css';

const subjectOptions = [
    { value: 'ORDER', label: 'Order' },
    { value: 'SUPPORT', label: 'Support' },
    { value: 'PARTNERSHIP', label: 'Partnership' },
    { value: 'OTHER', label: 'Other' },
];

const initialFormState = {
    fullName: '',
    email: '',
    subject: 'ORDER',
    message: '',
    phone: '',
    companyWebsite: '',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Contact() {
    const [formValues, setFormValues] = useState(initialFormState);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    const turnstileRef = useRef(null);
    const turnstileWidgetId = useRef(null);
    const siteKey = import.meta.env?.VITE_TURNSTILE_SITE_KEY || '';

    useEffect(() => {
        if (!siteKey) {
            return undefined;
        }

        let isActive = true;

        const renderWidget = () => {
            if (!isActive || !turnstileRef.current || !window.turnstile) {
                return;
            }

            if (turnstileWidgetId.current !== null) {
                window.turnstile.reset(turnstileWidgetId.current);
                return;
            }

            turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
                sitekey: siteKey,
                theme: 'light',
                callback: (token) => {
                    if (!isActive) {
                        return;
                    }
                    setTurnstileToken(token);
                    setErrors((prev) => ({ ...prev, turnstileToken: undefined }));
                },
                'error-callback': () => {
                    if (!isActive) {
                        return;
                    }
                    setTurnstileToken('');
                    setErrors((prev) => ({
                        ...prev,
                        turnstileToken: 'Verification failed. Please try again.',
                    }));
                },
                'expired-callback': () => {
                    if (!isActive) {
                        return;
                    }
                    setTurnstileToken('');
                },
            });
        };

        if (window.turnstile) {
            renderWidget();
            return () => {
                isActive = false;
            };
        }

        const existingScript = document.querySelector('script[data-turnstile]');
        if (existingScript) {
            existingScript.addEventListener('load', renderWidget);
            return () => {
                isActive = false;
                existingScript.removeEventListener('load', renderWidget);
            };
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.turnstile = 'true';
        script.addEventListener('load', renderWidget);
        script.addEventListener('error', () => {
            if (!isActive) {
                return;
            }
            setErrors((prev) => ({
                ...prev,
                turnstileToken: 'Verification failed to load. Please try again later.',
            }));
        });
        document.body.appendChild(script);

        return () => {
            isActive = false;
            script.removeEventListener('load', renderWidget);
        };
    }, [siteKey]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormValues((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const validateForm = (values) => {
        const nextErrors = {};
        if (!values.fullName.trim() || values.fullName.trim().length < 2) {
            nextErrors.fullName = 'Please enter your full name.';
        }
        if (!values.email.trim()) {
            nextErrors.email = 'Please enter your email address.';
        } else if (!emailPattern.test(values.email.trim())) {
            nextErrors.email = 'Please enter a valid email address.';
        }
        if (!values.subject) {
            nextErrors.subject = 'Please select a subject.';
        }
        const messageLength = values.message.trim().length;
        if (!messageLength) {
            nextErrors.message = 'Please enter your message.';
        } else if (messageLength < 20) {
            nextErrors.message = 'Your message must be at least 20 characters.';
        } else if (messageLength > 2000) {
            nextErrors.message = 'Your message must be under 2000 characters.';
        }
        if (values.companyWebsite) {
            nextErrors.companyWebsite = 'Please leave this field blank.';
        }
        if (!siteKey) {
            nextErrors.turnstileToken = 'Verification is unavailable. Please try again later.';
        } else if (!turnstileToken) {
            nextErrors.turnstileToken = 'Please complete the verification.';
        }
        return nextErrors;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setStatus(null);

        const nextErrors = validateForm(formValues);
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullName: formValues.fullName.trim(),
                    email: formValues.email.trim(),
                    phone: formValues.phone.trim() || '',
                    subject: formValues.subject,
                    message: formValues.message.trim(),
                    companyWebsite: formValues.companyWebsite.trim(),
                    turnstileToken,
                }),
            });

            if (response.ok) {
                setFormValues(initialFormState);
                setErrors({});
                setStatus({ type: 'success', message: "Message sent. We'll reply to your email." });
                setTurnstileToken('');
                if (window.turnstile && turnstileWidgetId.current !== null) {
                    window.turnstile.reset(turnstileWidgetId.current);
                }
                return;
            }

            if (response.status === 400) {
                let payload = null;
                try {
                    payload = await response.json();
                } catch (parseError) {
                    payload = null;
                }

                const fieldNames = [...Object.keys(initialFormState), 'turnstileToken'];
                const possibleErrors = payload?.errors || payload?.fieldErrors || payload;
                if (possibleErrors && typeof possibleErrors === 'object') {
                    const fieldErrors = fieldNames.reduce((acc, field) => {
                        if (typeof possibleErrors[field] === 'string') {
                            acc[field] = possibleErrors[field];
                        }
                        return acc;
                    }, {});
                    if (Object.keys(fieldErrors).length > 0) {
                        setErrors(fieldErrors);
                        setStatus({
                            type: 'error',
                            message: 'Please review the highlighted fields and try again.',
                        });
                        return;
                    }
                }

                setStatus({
                    type: 'error',
                    message: payload?.message || 'We could not send your message. Please try again.',
                });
                return;
            }

            if (response.status === 429) {
                setStatus({
                    type: 'error',
                    message: 'Too many requests. Please try again in a minute.',
                });
                return;
            }

            setStatus({
                type: 'error',
                message: 'Something went wrong on our side. Please try again shortly.',
            });
        } catch (error) {
            setStatus({
                type: 'error',
                message: 'We could not send your message. Please check your connection and try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className={styles.page}>
            <h1 className={styles.title}>Contact HydroLeaf</h1>
            <p className={styles.text}>
                Reach out to HydroLeaf using the contact details below. We are happy to help with
                questions about our products, orders, or partnerships.
            </p>
            <div className={styles.cards}>
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Email</h2>
                    <p className={styles.cardText}>
                        <a className={styles.link} href="mailto:info@hydroleaf.se">
                            info@hydroleaf.se
                        </a>
                    </p>
                </section>
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Phone</h2>
                    <p className={styles.cardText}>
                        <a className={styles.link} href="tel:+46724492009">
                            +46 72 449 2009
                        </a>
                    </p>
                </section>
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Registered address / Head office</h2>
                    <div className={styles.cardText}>
                        <p className={styles.addressLine}>Company: HydroLeaf AB</p>
                        <p className={styles.addressLine}>Street: Gustav III:s Boulevard 92</p>
                        <p className={styles.addressLine}>Postal/City: 169 74 Solna</p>
                        <p className={styles.addressLine}>Country: Sweden</p>
                    </div>
                </section>
                <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Greenhouse / Production site</h2>
                    <div className={styles.cardText}>
                        <p className={styles.addressLine}>Street: Isafjordsgatan 39B</p>
                        <p className={styles.addressLine}>Postal/City: 164 40 Kista</p>
                        <p className={styles.addressLine}>Country: Sweden</p>
                    </div>
                </section>
            </div>
            <section className={styles.formSection}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Send us a message</h2>
                    <p className={styles.sectionSubtitle}>We usually reply within 1 business day.</p>
                </div>
                <section className={`${styles.card} ${styles.formCard}`}>
                    <form className={styles.form} onSubmit={handleSubmit} noValidate>
                        <div className={styles.formGrid}>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel} htmlFor="fullName">
                                    Full name *
                                </label>
                                <input
                                    className={`${styles.fieldControl} ${errors.fullName ? styles.fieldControlError : ''}`}
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    value={formValues.fullName}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    autoComplete="name"
                                    required
                                    minLength={2}
                                    aria-invalid={Boolean(errors.fullName)}
                                    aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                                />
                                {errors.fullName ? (
                                    <span className={styles.fieldError} id="fullName-error">
                                        {errors.fullName}
                                    </span>
                                ) : null}
                            </div>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel} htmlFor="email">
                                    Email *
                                </label>
                                <input
                                    className={`${styles.fieldControl} ${errors.email ? styles.fieldControlError : ''}`}
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formValues.email}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    autoComplete="email"
                                    required
                                    aria-invalid={Boolean(errors.email)}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                />
                                {errors.email ? (
                                    <span className={styles.fieldError} id="email-error">
                                        {errors.email}
                                    </span>
                                ) : null}
                            </div>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel} htmlFor="phone">
                                    Phone
                                </label>
                                <input
                                    className={styles.fieldControl}
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    value={formValues.phone}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    autoComplete="tel"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.fieldLabel} htmlFor="subject">
                                    Subject *
                                </label>
                                <select
                                    className={`${styles.fieldControl} ${errors.subject ? styles.fieldControlError : ''}`}
                                    id="subject"
                                    name="subject"
                                    value={formValues.subject}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                    aria-invalid={Boolean(errors.subject)}
                                    aria-describedby={errors.subject ? 'subject-error' : undefined}
                                >
                                    {subjectOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {errors.subject ? (
                                    <span className={styles.fieldError} id="subject-error">
                                        {errors.subject}
                                    </span>
                                ) : null}
                            </div>
                            <div className={`${styles.field} ${styles.fieldFull}`}>
                                <label className={styles.fieldLabel} htmlFor="message">
                                    Message *
                                </label>
                                <textarea
                                    className={`${styles.fieldControl} ${styles.textarea} ${errors.message ? styles.fieldControlError : ''}`}
                                    id="message"
                                    name="message"
                                    value={formValues.message}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                    minLength={20}
                                    maxLength={2000}
                                    rows={6}
                                    aria-invalid={Boolean(errors.message)}
                                    aria-describedby={errors.message ? 'message-error' : undefined}
                                />
                                {errors.message ? (
                                    <span className={styles.fieldError} id="message-error">
                                        {errors.message}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className={styles.honeypot}>
                            <label htmlFor="companyWebsite">Company Website</label>
                            <input
                                id="companyWebsite"
                                name="companyWebsite"
                                type="text"
                                value={formValues.companyWebsite}
                                onChange={handleChange}
                                autoComplete="off"
                                tabIndex="-1"
                            />
                        </div>
                        {errors.companyWebsite ? (
                            <span className={styles.fieldError}>{errors.companyWebsite}</span>
                        ) : null}
                        <div className={styles.turnstile}>
                            <div ref={turnstileRef} />
                        </div>
                        {errors.turnstileToken ? (
                            <span className={styles.fieldError}>{errors.turnstileToken}</span>
                        ) : null}
                        {status ? (
                            <div
                                className={`${styles.alert} ${
                                    status.type === 'success' ? styles.alertSuccess : styles.alertError
                                }`}
                                role="status"
                            >
                                {status.message}
                            </div>
                        ) : null}
                        <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Sending...' : 'Send message'}
                        </button>
                    </form>
                </section>
            </section>
        </section>
    );
}
