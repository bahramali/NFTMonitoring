import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency.js';
import { customers as customerData } from './customerData.js';
import styles from './CustomersList.module.css';

const STATUS_OPTIONS = ['all', 'Active', 'At risk', 'Inactive'];
const TYPE_OPTIONS = ['all', 'Retail', 'Wholesale', 'Subscriber'];
const SORT_OPTIONS = [
    { value: 'last_order_desc', label: 'Last order (newest)' },
    { value: 'last_order_asc', label: 'Last order (oldest)' },
    { value: 'total_spent_desc', label: 'Total spent (high to low)' },
    { value: 'total_spent_asc', label: 'Total spent (low to high)' },
];

const PAGE_SIZE = 6;

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function CustomersList() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortBy, setSortBy] = useState('last_order_desc');
    const [page, setPage] = useState(1);

    const filteredCustomers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let list = customerData.filter((customer) => {
            const matchesTerm =
                !term ||
                customer.name.toLowerCase().includes(term) ||
                customer.email.toLowerCase().includes(term);
            const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
            const matchesType = typeFilter === 'all' || customer.type === typeFilter;
            return matchesTerm && matchesStatus && matchesType;
        });

        list = [...list].sort((a, b) => {
            if (sortBy.startsWith('last_order')) {
                const aTime = new Date(a.lastOrderDate).getTime();
                const bTime = new Date(b.lastOrderDate).getTime();
                return sortBy.endsWith('asc') ? aTime - bTime : bTime - aTime;
            }
            if (sortBy.startsWith('total_spent')) {
                return sortBy.endsWith('asc') ? a.totalSpent - b.totalSpent : b.totalSpent - a.totalSpent;
            }
            return 0;
        });

        return list;
    }, [searchTerm, sortBy, statusFilter, typeFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));

    const pagedCustomers = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredCustomers.slice(start, start + PAGE_SIZE);
    }, [filteredCustomers, page]);

    const handlePageChange = (nextPage) => {
        const clamped = Math.min(Math.max(nextPage, 1), totalPages);
        setPage(clamped);
    };

    return (
        <section className={styles.wrapper}>
            <div className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Store → Customers</p>
                    <h1>Customers</h1>
                    <p className={styles.subtitle}>Read-only CRM view with GDPR-safe customer insights.</p>
                </div>
                <div className={styles.summary}>
                    <div>
                        <span className={styles.summaryLabel}>Total customers</span>
                        <span className={styles.summaryValue}>{filteredCustomers.length}</span>
                    </div>
                    <div>
                        <span className={styles.summaryLabel}>Active</span>
                        <span className={styles.summaryValue}>
                            {filteredCustomers.filter((customer) => customer.status === 'Active').length}
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.filters}>
                <label className={styles.searchField}>
                    <span className={styles.filterLabel}>Search</span>
                    <input
                        type="search"
                        placeholder="Search by name or email"
                        value={searchTerm}
                        onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setPage(1);
                        }}
                    />
                </label>
                <label>
                    <span className={styles.filterLabel}>Status</span>
                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setPage(1);
                        }}
                    >
                        {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                                {status === 'all' ? 'All statuses' : status}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <span className={styles.filterLabel}>Customer type</span>
                    <select
                        value={typeFilter}
                        onChange={(event) => {
                            setTypeFilter(event.target.value);
                            setPage(1);
                        }}
                    >
                        {TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>
                                {type === 'all' ? 'All types' : type}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <span className={styles.filterLabel}>Sort by</span>
                    <select
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value)}
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className={styles.tableWrapper}>
                <table>
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Type</th>
                            <th>Last order</th>
                            <th>Total spent</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {pagedCustomers.map((customer) => (
                            <tr key={customer.id}>
                                <td>
                                    <div className={styles.customerCell}>
                                        <div className={styles.customerName}>{customer.name}</div>
                                        <div className={styles.customerEmail}>{customer.email}</div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`${styles.status} ${styles[`status${customer.status.replace(' ', '')}`]}`}>
                                        {customer.status}
                                    </span>
                                </td>
                                <td>{customer.type}</td>
                                <td>{formatDate(customer.lastOrderDate)}</td>
                                <td>{formatCurrency(customer.totalSpent, 'SEK')}</td>
                                <td>
                                    <Link to={`/store/admin/customers/${customer.id}`} className={styles.detailLink}>
                                        View details
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {pagedCustomers.length === 0 && (
                    <div className={styles.emptyState}>No customers match your filters.</div>
                )}
            </div>

            <div className={styles.pagination}>
                <button type="button" onClick={() => handlePageChange(page - 1)} disabled={page === 1}>
                    Previous
                </button>
                <div className={styles.pageInfo}>
                    Page {page} of {totalPages}
                </div>
                <button type="button" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                    Next
                </button>
            </div>
        </section>
    );
}
