import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listAdminCustomers } from '../../api/adminCustomers.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../utils/currency.js';
import styles from './CustomersList.module.css';

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active', queryValue: 'ACTIVE' },
    { value: 'at_risk', label: 'At risk', queryValue: 'AT_RISK' },
    { value: 'inactive', label: 'Inactive', queryValue: 'INACTIVE' },
];
const TYPE_OPTIONS = [
    { value: 'all', label: 'All types' },
    { value: 'retail', label: 'Retail', queryValue: 'RETAIL' },
    { value: 'wholesale', label: 'Wholesale', queryValue: 'WHOLESALE' },
    { value: 'subscriber', label: 'Subscriber', queryValue: 'SUBSCRIBER' },
];
const SORT_OPTIONS = [
    { value: 'last_order_desc', label: 'Last order (newest)' },
    { value: 'last_order_asc', label: 'Last order (oldest)' },
    { value: 'total_spent_desc', label: 'Total spent (high to low)' },
    { value: 'total_spent_asc', label: 'Total spent (low to high)' },
];

const PAGE_SIZE = 6;
const SEARCH_DEBOUNCE_MS = 300;

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function CustomersList() {
    const { token } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const hasInitializedFromUrl = useRef(false);
    const [searchInput, setSearchInput] = useState('');
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
    const fetchCountRef = useRef(0);

    useEffect(() => {
        console.debug('[CustomersList] mounted');
    }, []);

    useEffect(() => {
        if (hasInitializedFromUrl.current) return;
        const initialSearch = searchParams.get('q') ?? '';
        const statusParam = searchParams.get('status');
        const typeParam = searchParams.get('type');
        const sortParam = searchParams.get('sort');
        const pageParam = Number(searchParams.get('page'));

        const statusFromUrl =
            STATUS_OPTIONS.find((option) => option.queryValue?.toLowerCase() === statusParam?.toLowerCase())?.value ??
            'all';
        const typeFromUrl =
            TYPE_OPTIONS.find((option) => option.queryValue?.toLowerCase() === typeParam?.toLowerCase())?.value ??
            'all';
        const sortFromUrl = SORT_OPTIONS.some((option) => option.value === sortParam) ? sortParam : 'last_order_desc';

        setSearchInput(initialSearch);
        setSearchTerm(initialSearch);
        setStatusFilter(statusFromUrl);
        setTypeFilter(typeFromUrl);
        setSortBy(sortFromUrl);
        if (Number.isInteger(pageParam) && pageParam > 0) {
            setPage(pageParam);
        }
        hasInitializedFromUrl.current = true;
    }, [searchParams]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchTerm(searchInput.trim());
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handler);
    }, [searchInput]);

    useEffect(() => {
        if (!hasInitializedFromUrl.current) return;
        const nextParams = new URLSearchParams();
        if (searchTerm) nextParams.set('q', searchTerm);
        const statusOption = STATUS_OPTIONS.find((option) => option.value === statusFilter);
        if (statusOption?.queryValue) nextParams.set('status', statusOption.queryValue);
        const typeOption = TYPE_OPTIONS.find((option) => option.value === typeFilter);
        if (typeOption?.queryValue) nextParams.set('type', typeOption.queryValue);
        if (sortBy) nextParams.set('sort', sortBy);
        nextParams.set('page', page);
        nextParams.set('size', PAGE_SIZE);
        setSearchParams(nextParams, { replace: true });
    }, [page, searchTerm, setSearchParams, sortBy, statusFilter, typeFilter]);

    const queryParams = useMemo(() => {
        const statusOption = STATUS_OPTIONS.find((option) => option.value === statusFilter);
        const typeOption = TYPE_OPTIONS.find((option) => option.value === typeFilter);
        return {
            q: searchTerm.trim() || undefined,
            status: statusOption?.queryValue,
            type: typeOption?.queryValue,
            sort: sortBy,
            page,
            size: PAGE_SIZE,
        };
    }, [page, searchTerm, sortBy, statusFilter, typeFilter]);

    useEffect(() => {
        if (!token || !hasInitializedFromUrl.current) return undefined;
        const controller = new AbortController();
        const requestId = fetchCountRef.current + 1;
        fetchCountRef.current = requestId;
        console.debug(`[CustomersList] fetch #${requestId}`, queryParams);
        setLoading(true);
        setError('');

        listAdminCustomers(token, queryParams, { signal: controller.signal })
            .then((response) => {
                setCustomers(response.customers);
                setSummary({
                    totalCustomers: response.totalCustomers ?? response.total ?? response.customers.length,
                    activeCustomers:
                        response.activeCustomers ??
                        response.customers.filter((customer) => customer.status === 'Active').length,
                });
                setTotalPages(Math.max(1, response.totalPages ?? 1));
            })
            .catch((loadError) => {
                if (loadError?.name === 'AbortError') return;
                console.error('Failed to load customers', loadError);
                setError(loadError?.message || 'Unable to load customers right now. Please try again.');
                setCustomers([]);
                setSummary({ totalCustomers: 0, activeCustomers: 0 });
                setTotalPages(1);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [queryParams, token]);

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
                        value={searchInput}
                        onChange={(event) => {
                            setSearchInput(event.target.value);
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
                            <option key={status.value} value={status.value}>
                                {status.label}
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
                            <option key={type.value} value={type.value}>
                                {type.label}
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
                    <div className={styles.emptyState}>
                        {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                            ? 'No customers match your filters.'
                            : 'No customers yet.'}
                    </div>
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
