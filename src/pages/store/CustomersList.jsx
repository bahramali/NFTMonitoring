import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAdminCustomers } from '../../api/adminCustomers.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../utils/currency.js';
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
    const { token } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortBy, setSortBy] = useState('last_order_desc');
    const [page, setPage] = useState(1);
    const [customers, setCustomers] = useState([]);
    const [summary, setSummary] = useState({ totalCustomers: 0, activeCustomers: 0 });
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const queryParams = useMemo(() => {
        const normalizeParam = (value) => (value ? value.toLowerCase().replace(/\s+/g, '_') : value);
        return {
            q: searchTerm.trim() || undefined,
            status: statusFilter === 'all' ? undefined : normalizeParam(statusFilter),
            type: typeFilter === 'all' ? undefined : normalizeParam(typeFilter),
            sort: sortBy,
            page,
            size: PAGE_SIZE,
        };
    }, [page, searchTerm, sortBy, statusFilter, typeFilter]);

    const loadCustomers = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const response = await listAdminCustomers(token, queryParams);
            setCustomers(response.customers);
            setSummary({
                totalCustomers: response.totalCustomers ?? response.total ?? response.customers.length,
                activeCustomers: response.activeCustomers ?? response.customers.filter((customer) => customer.status === 'Active').length,
            });
            setTotalPages(Math.max(1, response.totalPages ?? 1));
        } catch (loadError) {
            console.error('Failed to load customers', loadError);
            setError(loadError?.message || 'Unable to load customers right now. Please try again.');
            setCustomers([]);
            setSummary({ totalCustomers: 0, activeCustomers: 0 });
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [queryParams, token]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

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
                        <span className={styles.summaryValue}>{summary.totalCustomers}</span>
                    </div>
                    <div>
                        <span className={styles.summaryLabel}>Active</span>
                        <span className={styles.summaryValue}>{summary.activeCustomers}</span>
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
                        onChange={(event) => {
                            setSortBy(event.target.value);
                            setPage(1);
                        }}
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
                {error && <div className={styles.emptyState}>{error}</div>}
                {loading && <div className={styles.emptyState}>Loading customers…</div>}
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
                        {customers.map((customer) => {
                            const statusLabel = customer.status || '—';
                            const statusKey = `${customer.status || ''}`.replace(' ', '');
                            return (
                                <tr key={customer.id}>
                                <td>
                                    <div className={styles.customerCell}>
                                        <div className={styles.customerName}>{customer.name}</div>
                                        <div className={styles.customerEmail}>{customer.email}</div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`${styles.status} ${styles[`status${statusKey}`]}`}>
                                        {statusLabel}
                                    </span>
                                </td>
                                <td>{customer.type || '—'}</td>
                                <td>{formatDate(customer.lastOrderDate)}</td>
                                <td>{formatCurrency(customer.totalSpent, customer.currency || 'SEK')}</td>
                                <td>
                                    <Link to={`/store/admin/customers/${customer.id}`} className={styles.detailLink}>
                                        View details
                                    </Link>
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
                {!error && !loading && customers.length === 0 && (
                    <div className={styles.emptyState}>No customers yet.</div>
                )}
            </div>

            <div className={styles.pagination}>
                <button type="button" onClick={() => handlePageChange(page - 1)} disabled={page === 1 || loading}>
                    Previous
                </button>
                <div className={styles.pageInfo}>
                    Page {page} of {totalPages}
                </div>
                <button type="button" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages || loading}>
                    Next
                </button>
            </div>
        </section>
    );
}
