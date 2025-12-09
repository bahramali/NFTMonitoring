import React, { useMemo, useState } from 'react';
import styles from './Home.module.css';

const PRODUCTS = [
    {
        id: 'kit',
        name: 'Hydroponic Basil Kit',
        price: 149,
        description: 'Complete NFT kit with pump, nutrients, and lighting.',
    },
    {
        id: 'subscription',
        name: 'Weekly Basil Subscription',
        price: 19,
        description: 'Receive a fresh bundle every week for four weeks.',
    },
    {
        id: 'packaging',
        name: 'Premium Packaging Set',
        price: 29,
        description: 'Moisture-resistant pouches with custom labeling.',
    },
];

export default function Home() {
    const [cart, setCart] = useState({});

    const cartItems = useMemo(() => Object.values(cart), [cart]);

    const handleAddToCart = (product) => {
        setCart((previous) => {
            const existing = previous[product.id] || { ...product, quantity: 0 };
            return {
                ...previous,
                [product.id]: { ...existing, quantity: existing.quantity + 1 },
            };
        });
    };

    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <div>
                    <p className={styles.kicker}>Public store</p>
                    <h1 className={styles.title}>Browse basil products without logging in</h1>
                    <p className={styles.subtitle}>
                        Add products to your cart as a guest. Log in later to access dashboards tailored to your
                        role.
                    </p>
                </div>
                <div className={styles.cartBox}>
                    <h3>Your cart</h3>
                    {cartItems.length === 0 ? (
                        <p className={styles.empty}>Cart is empty. Add something from the list.</p>
                    ) : (
                        <ul className={styles.cartList}>
                            {cartItems.map((item) => (
                                <li key={item.id}>
                                    <div>
                                        <strong>{item.name}</strong>
                                        <p>x{item.quantity}</p>
                                    </div>
                                    <span>${item.price * item.quantity}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            <section className={styles.productGrid}>
                {PRODUCTS.map((product) => (
                    <article key={product.id} className={styles.card}>
                        <div>
                            <h3>{product.name}</h3>
                            <p className={styles.description}>{product.description}</p>
                        </div>
                        <div className={styles.footer}>${product.price}
                            <button type="button" onClick={() => handleAddToCart(product)}>
                                Add to cart
                            </button>
                        </div>
                    </article>
                ))}
            </section>
        </main>
    );
}
