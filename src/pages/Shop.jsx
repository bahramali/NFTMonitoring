import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import hydroleafLogo from '../assets/hydroleaf_logo.png';
import styles from './Shop.module.css';

const HYDROPONIC_ITEMS = [
    {
        title: 'کیت NFT خانگی ۱۲ ردیفه',
        badge: 'آماده نصب',
        description: 'برای شروع کشت ریحان بدون دردسر.',
        points: ['پمپ کم‌صدا و مخزن ۶۰ لیتری', 'چراغ طیف کامل ۹۰ وات', 'راهنمای نصب ۱۵ دقیقه‌ای'],
    },
    {
        title: 'کنترلر تغذیه و EC',
        badge: 'پایش لحظه‌ای',
        description: 'پایش و تنظیم اتوماتیک برای ثبات طعم.',
        points: ['سنسور EC و pH کالیبره', 'هشدار تلگرامی و داشبورد', 'دوزینگ نرم و قابل تنظیم'],
    },
    {
        title: 'کیت نهال‌کاری و ریشه‌زایی',
        badge: 'شتاب رشد',
        description: 'برای قلمه‌گیری و آماده‌سازی بذر.',
        points: ['۲۴ حفره با درپوش رطوبت', 'مهپاش اولتراسونیک کوچک', 'پک مواد مغذی هفته اول'],
    },
];

const PACKAGING_BUNDLES = [
    {
        title: 'بسته ۵۰ گرمی کافه‌ای',
        badge: 'پرفروش',
        description: 'برای ارسال سریع سفارش آنلاین.',
        points: ['سلفون مات با زیپ‌لاک', 'جای لیبل لوگوی شما', 'پایداری ۴۸ ساعته در سردخانه'],
    },
    {
        title: 'بسته ۱۰۰ گرمی سوپرمارکت',
        badge: 'نمایش قفسه‌ای',
        description: 'ظاهر شفاف و آماده عرضه حضوری.',
        points: ['پلمپ حرارتی و پانچ هوا', 'کارتریج بارکد/تاریخ', 'شلف لایف ۵ تا ۷ روز'],
    },
    {
        title: 'جعبه هدیه ریحان',
        badge: 'ویژه برندینگ',
        description: 'برای فروش مستقیم و اشتراک هفتگی.',
        points: ['مقوای ضد‌رطوبت با لاینر', 'پک یخ ژلی و تهویه مخفی', 'فضای بروشور نوشیدنی و سالاد'],
    },
];

const SERVICE_POINTS = [
    'زمان‌بندی برداشت و بسته‌بندی طبق سفارش شما',
    'ارسال نمونه طراحی لیبل در کمتر از ۲۴ ساعت',
    'هماهنگی لجستیک یخچال‌دار برای شهرهای مجاور',
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
            navigate('/dashboard/overview', { replace: true });
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
                        <a href="#hydroponic">تجهیزات هیدروپونیک</a>
                        <a href="#packaging">بسته‌بندی ریحان</a>
                        <a href="#contact">پشتیبانی</a>
                    </div>
                    <button
                        type="button"
                        className={styles.navButton}
                        onClick={() =>
                            navigate(isAuthenticated ? '/dashboard/overview' : '/login', { replace: true })
                        }
                    >
                        {isAuthenticated ? 'ورود به داشبورد' : 'ورود مدیر'}
                    </button>
                </nav>

                <div className={styles.heroContent}>
                    <div>
                        <p className={styles.kicker}>تازه، معطر و آماده فروش</p>
                        <h1 className={styles.title}>
                            ریحان در بسته‌بندی‌های متنوع و تجهیزات کامل برای رشد هیدروپونیک
                        </h1>
                        <p className={styles.subtitle}>
                            فروش را به دو بخش تقسیم کردیم: تجهیزات کشت برای رشد یکنواخت و بسته‌بندی‌های
                            آماده فروش تا محصول بدون دغدغه به دست مشتری برسد.
                        </p>
                        <div className={styles.pillRow}>
                            <span className={styles.pill}>تحویل سریع در ۴۸ ساعت</span>
                            <span className={styles.pill}>لیبل اختصاصی برای برند شما</span>
                            <span className={styles.pill}>مشاوره رایگان بسته‌بندی</span>
                        </div>
                    </div>
                    <div className={styles.heroCard}>
                        <div className={styles.statGrid}>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>+18</div>
                                <div className={styles.statLabel}>مدل بسته‌بندی آماده</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>۲۴/۷</div>
                                <div className={styles.statLabel}>پشتیبانی کشت و برداشت</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>۵ تا ۷ روز</div>
                                <div className={styles.statLabel}>ماندگاری در سردخانه</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statValue}>داشبورد</div>
                                <div className={styles.statLabel}>دسترسی بعد از ورود مدیر</div>
                            </div>
                        </div>
                        <p className={styles.heroNote}>
                            انتخاب کنید که الان فروش محصول را پیش ببرید یا تجهیزات هیدروپونیک را برای کشت
                            پایدار تهیه کنید. ما دو مسیر جدا اما هماهنگ برای شما چیده‌ایم.
                        </p>
                    </div>
                </div>
            </header>

            <section id="hydroponic" className={styles.section}>
                <div className={styles.sectionHeader}>
                    <p className={styles.sectionKicker}>تجهیزات هیدروپونیک</p>
                    <h2>همه چیز برای یک برداشت یکنواخت</h2>
                    <p>کیت‌ها و کنترلرها کوچک و کاربردی هستند تا در فضای محدود هم جا شوند.</p>
                </div>
                <div className={styles.cardGrid}>
                    {HYDROPONIC_ITEMS.map((item) => (
                        <FeatureCard key={item.title} {...item} />
                    ))}
                </div>
            </section>

            <section id="packaging" className={styles.section}>
                <div className={styles.sectionHeader}>
                    <p className={styles.sectionKicker}>بسته‌بندی ریحان</p>
                    <h2>معرفی بسته‌های فروش فوری</h2>
                    <p>برای هر کانال فروش (آنلاین، سوپرمارکت یا هدیه) یک انتخاب جمع‌وجور آماده کرده‌ایم.</p>
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
                        <h3>هماهنگی فوری فروش</h3>
                        <p className={styles.calloutText}>
                            اطلاعات بسته‌بندی، لیبل اختصاصی و زمان‌بندی برداشت را با هم مرور می‌کنیم تا فروش بدون
                            توقف جلو برود.
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
                            تماس برای مشاوره
                        </a>
                        <button
                            type="button"
                            className={styles.secondaryAction}
                            onClick={() =>
                                navigate(isAuthenticated ? '/dashboard/overview' : '/login', { replace: true })
                            }
                        >
                            مشاهده داشبورد بعد از ورود
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
