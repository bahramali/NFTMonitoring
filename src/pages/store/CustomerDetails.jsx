import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency.js';
import { customers } from './customerData.js';
import styles from './CustomerDetails.module.css';

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function CustomerDetails() {
    const { customerId } = useParams();

    const customer = useMemo(
        () => customers.find((entry) => entry.id === customerId),
        [customerId],
    );

    if (!customer) {
        return (
            <section className={styles.wrapper}>
                <Link to="/store/admin/customers" className={styles.backLink}>
                    ← Back to customers
                </Link>
                <div className={styles.emptyState}>
                    <h1>Customer not found</h1>
                    <p>We couldn’t locate that customer. Please return to the list and try again.</p>
                </div>
            </section>
        );
    }

    return (
        <section className={styles.wrapper}>
            <Link to="/store/admin/customers" className={styles.backLink}>
                ← Back to customers
            </Link>

            <div className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Store → Customers</p>
                    <h1>{customer.name}</h1>
                    <p className={styles.subtitle}>Read-only profile overview and order history.</p>
                </div>
                <span className={`${styles.status} ${styles[`status${customer.status.replace(' ', '')}`]}`}>
                    {customer.status}
                </span>
            </div>

            <div className={styles.profileGrid}>
                <div className={styles.profileCard}>
                    <h2>Profile</h2>
                    <dl>
                        <div>
                            <dt>Name</dt>
                            <dd>{customer.name}</dd>
                        </div>
                        <div>
                            <dt>Email</dt>
                            <dd>{customer.email}</dd>
                        </div>
                        <div>
                            <dt>Customer type</dt>
                            <dd>{customer.type}</dd>
                        </div>
                        <div>
                            <dt>Last order</dt>
                            <dd>{formatDate(customer.lastOrderDate)}</dd>
                        </div>
                        <div>
                            <dt>Total spent</dt>
                            <dd>{formatCurrency(customer.totalSpent, 'SEK')}</dd>
                        </div>
                    </dl>
                </div>
                <div className={styles.profileCard}>
                    <h2>GDPR-safe notes</h2>
                    <ul>
                        <li>No payment details stored in this view.</li>
                        <li>No passwords or technical identifiers shown.</li>
                        <li>Orders are read-only for compliance.</li>
                    </ul>
                </div>
            </div>

            <div className={styles.ordersSection}>
                <div className={styles.ordersHeader}>
                    <h2>Orders</h2>
                    <span className={styles.orderCount}>{customer.orders.length} total</span>
                </div>
                <div className={styles.ordersTable}>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Status</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customer.orders.map((order) => (
                                <tr key={`${customer.id}-${order.date}-${order.total}`}>
                                    <td>{formatDate(order.date)}</td>
                                    <td>{order.items}</td>
                                    <td>
                                        <span className={styles.orderStatus}>{order.status}</span>
                                    </td>
                                    <td>{formatCurrency(order.total, 'SEK')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
