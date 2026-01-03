import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

export default function About() {
    return (
        <section className={styles.page}>
            <header className={styles.hero}>
                <h1 className={styles.title}>About HydroLeaf</h1>
                <p className={styles.lead}>
                    HydroLeaf is a Stockholm-based grower focused on fresh basil and leafy greens. We use modern
                    hydroponics and careful monitoring to deliver clean, consistent produce with minimal waste.
                </p>
            </header>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Our mission</h2>
                    <p className={styles.sectionText}>
                        Our mission is simple: grow fresh greens locally, reduce unnecessary transport, and deliver
                        consistent quality you can trust.
                    </p>
                </div>
                <ul className={styles.bullets}>
                    <li>
                        <strong>Freshness:</strong> harvested close to delivery and stored properly.
                    </li>
                    <li>
                        <strong>Sustainability:</strong> efficient water use and reduced food miles.
                    </li>
                    <li>
                        <strong>Consistency:</strong> controlled conditions and data-driven monitoring.
                    </li>
                </ul>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>How we grow</h2>
                <div className={styles.cardGrid}>
                    <article className={styles.card}>
                        <h3 className={styles.cardTitle}>Controlled environment</h3>
                        <p className={styles.cardText}>
                            We cultivate indoors where light, temperature, and humidity are tuned for healthy growth.
                        </p>
                    </article>
                    <article className={styles.card}>
                        <h3 className={styles.cardTitle}>Hydroponic growing</h3>
                        <p className={styles.cardText}>
                            No soil needed. Nutrient-rich water keeps roots fed while minimizing waste.
                        </p>
                    </article>
                    <article className={styles.card}>
                        <h3 className={styles.cardTitle}>Clean water + monitoring</h3>
                        <p className={styles.cardText}>
                            We monitor key metrics continuously to keep the system balanced and predictable.
                        </p>
                    </article>
                    <article className={styles.card}>
                        <h3 className={styles.cardTitle}>Harvest &amp; handling</h3>
                        <p className={styles.cardText}>
                            Greens are harvested to order and handled with care to preserve freshness.
                        </p>
                    </article>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Quality &amp; handling</h2>
                <p className={styles.sectionText}>
                    We take product quality seriously. From cultivation to harvest and packing, we prioritize clean
                    handling and aim for pesticide-free growing through controlled conditions. We also keep clear batch
                    records to support traceability.
                </p>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Where we operate</h2>
                <div className={styles.addressGrid}>
                    <div className={styles.addressCard}>
                        <p className={styles.addressLabel}>Registered address / Head office</p>
                        <p className={styles.addressValue}>Solna</p>
                    </div>
                    <div className={styles.addressCard}>
                        <p className={styles.addressLabel}>Greenhouse / Production site</p>
                        <p className={styles.addressValue}>Kista</p>
                    </div>
                </div>
                <p className={styles.sectionFootnote}>
                    For official contact details and full addresses, please visit our <Link to="/contact" className={styles.link}>Contact page</Link>.
                </p>
            </section>

            <section className={styles.ctaSection}>
                <div>
                    <h2 className={styles.sectionTitle}>Ready to try HydroLeaf?</h2>
                    <p className={styles.sectionText}>
                        Shop our products or contact us if you have questions about orders or partnerships.
                    </p>
                </div>
                <div className={styles.ctaActions}>
                    <Link to="/store" className={styles.ctaPrimary}>Shop products</Link>
                    <Link to="/contact" className={styles.ctaSecondary}>Contact us</Link>
                </div>
            </section>
        </section>
    );
}
