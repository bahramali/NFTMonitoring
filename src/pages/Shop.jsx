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
            setError('نام کاربری یا رمز عبور نادرست است.');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <nav className={styles.navbar}>
                    <div className={styles.brand}>HydroLeaf Market</div>
                    <div className={styles.links}>
                        <a href="#products">محصولات</a>
                        <a href="#about">چرا ما</a>
                    </div>
                    {isAuthenticated ? (
                        <button
                            type="button"
                            className={styles.dashboardButton}
                            onClick={() => navigate(DASHBOARD_HOME)}
                        >
                            مشاهده داشبورد
                        </button>
                    ) : (
                        <form className={styles.inlineLogin} onSubmit={handleLogin}>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="نام کاربری"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                required
                            />
                            <input
                                className={styles.input}
                                type="password"
                                placeholder="رمز عبور"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                            <button className={styles.loginButton} type="submit">
                                ورود ادمین
                            </button>
                        </form>
                    )}
                </nav>

                <div className={styles.heroContent}>
                    <div>
                        <p className={styles.kicker}>فروشگاه رسمی تجهیزات NFT</p>
                        <h1 className={styles.title}>محصولات را ببینید و فقط در صورت نیاز وارد داشبورد شوید</h1>
                        <p className={styles.subtitle}>
                            بدون ورود، محصولات آماده‌ی ارسال را مشاهده کنید. با ورود ادمین،
                            مستقیماً به داشبورد کنترلی منتقل می‌شوید.
                        </p>
                        <div className={styles.ctaRow}>
                            <a className={styles.primaryCta} href="#products">مشاهده محصولات</a>
                            <div className={styles.secondaryCta}>
                                <span className={styles.dot} />
                                اتصال امن داشبورد برای مدیران فعال است.
                            </div>
                        </div>
                        {error && <div className={styles.error}>{error}</div>}
                    </div>
                    <div className={styles.heroCard}>
                        <div className={styles.heroBadge}>ویژه گلخانه‌های هوشمند</div>
                        <div className={styles.metricGrid}>
                            <div>
                                <div className={styles.metricLabel}>پشتیبانی آنلاین</div>
                                <div className={styles.metricValue}>24/7</div>
                            </div>
                            <div>
                                <div className={styles.metricLabel}>گارانتی</div>
                                <div className={styles.metricValue}>12 ماه</div>
                            </div>
                            <div>
                                <div className={styles.metricLabel}>ارسال سریع</div>
                                <div className={styles.metricValue}>48 ساعت</div>
                            </div>
                            <div>
                                <div className={styles.metricLabel}>تامین قطعه</div>
                                <div className={styles.metricValue}>دائمی</div>
                            </div>
                        </div>
                        <p className={styles.heroNote}>
                            برای مدیریت و پایش دقیق، با حساب ادمین وارد شوید. در غیر این صورت آزادانه محصولات را بررسی کنید.
                        </p>
                    </div>
                </div>
            </header>

            <section id="products" className={styles.productsSection}>
                <div className={styles.sectionHeader}>
                    <h2>محصولات آماده‌ی فروش</h2>
                    <p>بدون نیاز به ورود، مشخصات و قیمت‌ها را بررسی کنید.</p>
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
                    <h2>در کنار داشبورد پایش لحظه‌ای</h2>
                    <p>
                        هر محصول با سنسورها و سیستم پایش شما سازگار است. با ورود ادمین می‌توانید
                        به بخش‌های Overview ،Live و دیگر ماژول‌های داشبورد دسترسی داشته باشید.
                    </p>
                </div>
                <div className={styles.highlights}>
                    <div className={styles.highlightCard}>
                        <div className={styles.highlightTitle}>ورود امن ادمین</div>
                        <p>پس از وارد کردن نام کاربری و رمز عبور، به داشبورد مدیریتی منتقل می‌شوید.</p>
                    </div>
                    <div className={styles.highlightCard}>
                        <div className={styles.highlightTitle}>نمایش آزاد محصولات</div>
                        <p>بدون ورود، همه‌ی کالاها و قیمت‌ها قابل مشاهده هستند.</p>
                    </div>
                    <div className={styles.highlightCard}>
                        <div className={styles.highlightTitle}>مدیریت یکپارچه</div>
                        <p>در داشبورد، کنترل پنل، گزارش‌ها و پیکربندی سنسورها در دسترس شماست.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
