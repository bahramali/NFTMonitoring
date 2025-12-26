import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import hydroleafLogo from '../assets/hydroleaf_logo.png';
import styles from './Shop.module.css';

const HYDROPONIC_ITEMS = [
    {
        title: '12-Row Home NFT Kit',
        badge: 'Ready to install',
        description: 'Start growing basil without extra setup.',
        points: ['Quiet pump with 60L reservoir', '90W full-spectrum light', '15-minute assembly guide'],
    },
    {
        title: 'Nutrient & EC Controller',
        badge: 'Live monitoring',
        description: 'Automatic dosing to keep flavor consistent.',
        points: ['Calibrated EC and pH sensors', 'Telegram alerts and dashboard', 'Smooth, adjustable dosing'],
    },
    {
        title: 'Propagation & Rooting Kit',
        badge: 'Fast start',
        description: 'For cutting prep and seed starting.',
        points: ['24 cells with humidity domes', 'Compact ultrasonic mister', 'Week-one nutrient pack'],
    },
];

const PACKAGING_BUNDLES = [
    {
        title: '50g Café Pouch',
        badge: 'Top seller',
        description: 'Sized for quick online orders.',
        points: ['Matte zipper pouch', 'Space for your logo label', '48-hour cold shelf life'],
    },
    {
        title: '100g Market Pack',
        badge: 'Shelf-ready',
        description: 'Clear look for in-store presentation.',
        points: ['Heat seal with air punch', 'Barcode/date cartridge', '5–7 day shelf life'],
    },
    {
        title: 'Basil Gift Box',
        badge: 'Brand-friendly',
        description: 'Ideal for direct sales or weekly subscriptions.',
        points: ['Moisture-resistant liner', 'Gel ice pack with hidden vents', 'Brochure space for recipes'],
    },
];

const SERVICE_POINTS = [
    'Harvest and packaging scheduled to your orders',
    'Label design mock sent in under 24 hours',
    'Chilled logistics coordinated for nearby cities',
];

function FeatureCard({ title, badge, description, points }) {
    return (
        <article className={styles.card}>
            <div className={styles.cardHead}>
                <div>
                    <h3>{title}</h3>
                    <p className={styles.cardDescription}>{description}</p>
                </div>
                {badge ? <span className={styles.badge}>{badge}</span> : null}
            </div>
            <ul className={styles.pointList}>
                {points.map((point) => (
                    <li key={point}>
                        <span className={styles.pointDot} />
                        <span>{point}</span>
                    </li>
                ))}
            </ul>
        </article>
    );
}

export default function Shop() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/monitoring/overview', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <nav className={styles.navbar}>
                    <div className={styles.brand}>
                        <img src={hydroleafLogo} alt="HydroLeaf" className={styles.brandLogo} />
                        <span className={styles.brandName}>HydroLeaf Farm</span>
                    </div>
                    <div className={styles.links}>
                        <a href="#hydroponic">Hydroponic gear</a>
                        <a href="#packaging">Basil packaging</a>
                        <a href="#contact">Support</a>
                    </div>
                    <button
                        type="button"
                        className={styles.navButton}
                        onClick={() =>
                            navigate(isAuthenticated ? '/monitoring/overview' : '/login', { replace: true })
                        }
                    >
                        {isAuthenticated ? 'Go to dashboard' : 'Manager login'}
                    </button>
                </nav>

                <div className={styles.heroContent}>
                    <div>
                        <p className={styles.kicker}>Fresh, aromatic, and ready to sell</p>
                        <h1 className={styles.title}>
                            Basil in versatile packaging and complete hydroponic gear
                        </h1>
                        <p className={styles.subtitle}>
                            We split the journey into two tracks: grow equipment for consistent yields and
                            packaging that keeps every delivery effortless.
                        </p>
                        <div className={styles.pillRow}>
                            <span className={styles.pill}>Fast handoff in 48 hours</span>
                            <span className={styles.pill}>Custom label for your brand</span>
                            <span className={styles.pill}>Free packaging consult</span>
                        </div>
                    </div>
                    <div className={styles.heroCard}>
                        <div className={styles.statGrid}>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>+18</div>
                                <div className={styles.statLabel}>Ready-to-ship packaging styles</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>24/7</div>
                                <div className={styles.statLabel}>Grow and harvest support</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>5 to 7 days</div>
                                <div className={styles.statLabel}>Cold storage shelf life</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>Dashboard</div>
                                <div className={styles.statLabel}>Access after manager login</div>
                            </div>
                        </div>
                        <p className={styles.heroNote}>
                            Choose whether to push sales right now or equip your hydroponic setup for steady
                            production. We designed two paths that stay aligned.
                        </p>
                    </div>
                </div>
            </header>

            <section id="hydroponic" className={styles.section}>
                <div className={styles.sectionHeader}>
                    <p className={styles.sectionKicker}>Hydroponic gear</p>
                    <h2>Everything for a steady harvest</h2>
                    <p>Compact kits and controllers that fit comfortably in tight spaces.</p>
                </div>
                <div className={styles.cardGrid}>
                    {HYDROPONIC_ITEMS.map((item) => (
                        <FeatureCard key={item.title} {...item} />
                    ))}
                </div>
            </section>

            <section id="packaging" className={styles.section}>
                <div className={styles.sectionHeader}>
                    <p className={styles.sectionKicker}>Basil packaging</p>
                    <h2>Bundles ready to sell fast</h2>
                    <p>Pick a compact option for each channel—online, retail, or gifting.</p>
                </div>
                <div className={styles.cardGrid}>
                    {PACKAGING_BUNDLES.map((item) => (
                        <FeatureCard key={item.title} {...item} />
                    ))}
                </div>
            </section>

            <section id="contact" className={styles.section}>
                <div className={styles.callout}>
                    <div>
                        <h3>Sales coordination on call</h3>
                        <p className={styles.calloutText}>
                            We review packaging details, custom labels, and harvest timing together so sales
                            stay uninterrupted.
                        </p>
                        <ul className={styles.pointList}>
                            {SERVICE_POINTS.map((point) => (
                                <li key={point}>
                                    <span className={styles.pointDot} />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={styles.calloutActions}>
                        <a className={styles.primaryAction} href="tel:+989120000000">
                            Call for a consult
                        </a>
                        <button
                            type="button"
                            className={styles.secondaryAction}
                            onClick={() =>
                                navigate(isAuthenticated ? '/monitoring/overview' : '/login', { replace: true })
                            }
                        >
                            View dashboard after login
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
