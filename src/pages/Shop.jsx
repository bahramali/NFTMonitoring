import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Shop.module.css';

const DASHBOARD_HOME = '/dashboard/overview';

const PRODUCT_LIST = [
    {
        name: 'NFT Channel Kit',
        price: '$249',
        description: 'Complete nutrient film technique channel kit with food-safe PVC and end caps.',
        badges: ['Hydroponic Ready', 'DIY Friendly'],
    },
    {
        name: 'Inline Pump 1200L/h',
        price: '$89',
        description: 'Energy-efficient circulation pump ideal for home grow racks and small greenhouses.',
        badges: ['Low Noise', '24/7 Rated'],
    },
    {
        name: 'Monitoring Starter',
        price: '$149',
        description: 'Core sensors (pH, EC, water temp) with quick-connect harness for rapid deployment.',
        badges: ['Plug & Play', 'Calibrated'],
    },
    {
        name: 'LED Grow Bar Duo',
        price: '$199',
        description: 'Balanced spectrum light bars with passive cooling for leafy greens and seedlings.',
        badges: ['Full Spectrum', 'Dimmable'],
    },
];

export default function Shop() {
    const { isAuthenticated, login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            navigate(DASHBOARD_HOME, { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const badgePalette = useMemo(
        () => ['#e0f2fe', '#fef9c3', '#ecfccb', '#fce7f3'],
        [],
    );

    const handleLogin = (event) => {
        event.preventDefault();
        setError('');
        const result = login(username, password);

        if (result.success) {
            navigate(DASHBOARD_HOME, { replace: true });
        } else {
            setError('Incorrect username or password.');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <nav className={styles.navbar}>
                    <div className={styles.brand}>
                        <img
                            src="./hydroleaf_logo.png"
                            alt="HydroLeaf Organic Products logo"
                            className={styles.brandLogo}
                        />
                    </div>
                    <div className={styles.links}>
                        <a href="#products">Products</a>
                        <a href="#about">Why us</a>
                    </div>
                    {isAuthenticated ? (
                        <button
                            type="button"
                            className={styles.dashboardButton}
                            onClick={() => navigate(DASHBOARD_HOME)}
                        >
                            View dashboard
                        </button>
                    ) : (
                        <form className={styles.inlineLogin} onSubmit={handleLogin}>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                required
                            />
                            <input
                                className={styles.input}
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                            <button className={styles.loginButton} type="submit">
                                Admin login
                            </button>
                        </form>
                    )}
                </nav>

                <div className={styles.heroContent}>
                    <div>
                        <p className={styles.kicker}>Official NFT hardware store</p>
                        <h1 className={styles.title}>Browse products and only sign in when you need the dashboard</h1>
                        <p className={styles.subtitle}>
                            View ready-to-ship products without signing in. With an admin login,
                            you go directly to the control dashboard.
                        </p>
                        <div className={styles.ctaRow}>
                            <a className={styles.primaryCta} href="#products">View products</a>
                            <div className={styles.secondaryCta}>
                                <span className={styles.dot} />
                                Secure dashboard connection is active for admins.
                            </div>
                        </div>
                        {error && <div className={styles.error}>{error}</div>}
                    </div>
                    <div className={styles.heroCard}>
                        <div className={styles.heroBadge}>Built for smart greenhouses</div>
                        <div className={styles.metricGrid}>
                            <div>
                                <div className={styles.metricLabel}>Online support</div>
                                <div className={styles.metricValue}>24/7</div>
                            </div>
                            <div>
                                <div className={styles.metricLabel}>Warranty</div>
                                <div className={styles.metricValue}>12 months</div>
                            </div>
                            <div>
                                <div className={styles.metricLabel}>Fast shipping</div>
                                <div className={styles.metricValue}>48 hours</div>
                            </div>
                            <div>
                                <div className={styles.metricLabel}>Parts supply</div>
                                <div className={styles.metricValue}>Ongoing</div>
                            </div>
                        </div>
                        <p className={styles.heroNote}>
                            Sign in with an admin account for precise management and monitoring. Otherwise, feel free to browse products openly.
                        </p>
                    </div>
                </div>
            </header>

            <section id="products" className={styles.productsSection}>
                <div className={styles.sectionHeader}>
                    <h2>Products ready to ship</h2>
                    <p>Review specs and pricing without logging in.</p>
                </div>
                <div className={styles.productGrid}>
                    {PRODUCT_LIST.map((product, index) => (
                        <article key={product.name} className={styles.productCard}>
                            <div className={styles.cardHeader}>
                                <h3>{product.name}</h3>
                                <span className={styles.price}>{product.price}</span>
                            </div>
                            <p className={styles.description}>{product.description}</p>
                            <div className={styles.badges}>
                                {product.badges.map((badge, badgeIndex) => (
                                    <span
                                        key={badge}
                                        className={styles.badge}
                                        style={{ backgroundColor: badgePalette[(index + badgeIndex) % badgePalette.length] }}
                                    >
                                        {badge}
                                    </span>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section id="about" className={styles.aboutSection}>
                <div>
                    <h2>Alongside the real-time monitoring dashboard</h2>
                    <p>
                        Every product is compatible with your sensors and monitoring system. With an admin login, you can
                        access the Overview, Live, and other dashboard modules.
                    </p>
                </div>
                <div className={styles.highlights}>
                    <div className={styles.highlightCard}>
                        <div className={styles.highlightTitle}>Secure admin login</div>
                        <p>After entering your username and password, you’re taken to the admin dashboard.</p>
                    </div>
                    <div className={styles.highlightCard}>
                        <div className={styles.highlightTitle}>Open product browsing</div>
                        <p>All items and pricing stay visible without signing in.</p>
                    </div>
                    <div className={styles.highlightCard}>
                        <div className={styles.highlightTitle}>Unified management</div>
                        <p>In the dashboard, the control panel, reports, and sensor configuration are ready for you.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
