import React from 'react';
import styles from './LegalPage.module.css';

export default function Contact() {
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
        </section>
    );
}
