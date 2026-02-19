import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminOrderDetails, listAdminOrders, updateAdminOrderStatus } from '../../api/adminOrders.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../utils/currency.js';
import { PERMISSIONS, hasPerm } from '../../utils/permissions.js';
import styles from './AdminOrders.module.css';

const STATUS_OPTIONS = ['RECEIVED', 'PREPARING', 'SHIPPING', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED'];
const PAYMENT_FILTERS = ['ALL', 'PAID', 'PENDING', 'FAILED'];
const DENSITY_STORAGE_KEY = 'admin-orders-board-density';
const COMPACT_STAGES_STORAGE_KEY = 'admin-orders-compact-stages';

const normalizeKey = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
const toDisplayValue = (value) => {
    if (value == null) return '—';
    const normalized = String(value).trim();
    return normalized || '—';
};

const isPickupOrder = (order) => normalizeKey(order?.fulfillmentType).includes('PICKUP');
const isCancelledStatus = (value) => ['CANCELLED_BY_CUSTOMER', 'CANCELLED'].includes(normalizeKey(value));
const isCancelledByCustomer = (order) => isCancelledStatus(order?.status);
const normalizeBoardStatus = (status) => {
    const key = normalizeKey(status);
    if (isCancelledStatus(status)) return 'CANCELLED';
    if (key === 'COMPLETED') return 'DELIVERED';
    return key;
};

const STATUS_BADGE_LABELS = {
    RECEIVED: 'Received',
    PREPARING: 'Preparing',
    SHIPPING: 'Shipping',
    READY_FOR_PICKUP: 'Preparing',
    DELIVERED: 'Delivered',
    COMPLETED: 'Delivered',
    CANCELLED: 'Cancelled',
    CANCELLED_BY_CUSTOMER: 'Cancelled',
};

const formatStatusBadge = (status) => {
    const key = normalizeKey(status);
    return STATUS_BADGE_LABELS[key] || 'Received';
};

const deliveryBadgeText = (order) => (isPickupOrder(order) ? 'PICKUP' : 'SHIPPING');

const paymentBadgeText = (order) => {
    const paymentKey = normalizeKey(order?.paymentStatus);
    const modeKey = normalizeKey(order?.paymentMode);
    if (['PAID', 'PAYMENT_SUCCEEDED', 'COMPLETED', 'PROCESSING'].includes(paymentKey)) return 'PAID';
    if (['PAY_LATER', 'INVOICE'].includes(modeKey)) return 'INVOICE';
    return 'UNPAID';
};

const statusBadgeClass = (status) => {
    const key = normalizeKey(status);
    if (['CANCELLED_BY_CUSTOMER', 'CANCELLED'].includes(key)) return styles.badgeRed;
    if (['DELIVERED', 'COMPLETED'].includes(key)) return styles.badgeGreen;
    if (['SHIPPING', 'READY_FOR_PICKUP', 'IN_TRANSIT'].includes(key)) return styles.badgeBlue;
    if (['PREPARING'].includes(key)) return styles.badgeYellow;
    return styles.badgeNeutral;
};

const paymentColorClass = (paymentLabel) => {
    if (paymentLabel === 'PAID') return styles.badgeGreen;
    if (paymentLabel === 'INVOICE') return styles.badgePurple;
    return styles.badgeRedSoft;
};

const deliveryColorClass = (order) => (isPickupOrder(order) ? styles.badgePurple : styles.badgeBlue);
const displayOrderNumber = (order) => order?.formattedOrderNumber || toDisplayValue(order?.orderNumber);
const toAddressLines = (address) => {
    if (!address) return [];
    const cityLine = [address.postalCode, address.city].filter(Boolean).join(' ');
    return [address.line1, address.line2, cityLine, address.state, address.country].filter(Boolean);
};

const filterDateRange = (orderDate, range) => {
    if (!range?.from && !range?.to) return true;
    const stamp = new Date(orderDate || 0).getTime();
    if (!stamp) return false;
    const from = range.from ? new Date(range.from).getTime() : null;
    const to = range.to ? new Date(`${range.to}T23:59:59`).getTime() : null;
    if (from && stamp < from) return false;
    if (to && stamp > to) return false;
    return true;
};

const ALLOWED_TRANSITIONS = {
    RECEIVED: ['PREPARING'],
    PREPARING: ['SHIPPING', 'READY_FOR_PICKUP'],
    SHIPPING: ['DELIVERED'],
    READY_FOR_PICKUP: ['DELIVERED'],
    DELIVERED: [],
};

export default function AdminOrders() {
    const { token, permissions } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [selectedDetails, setSelectedDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');
    const [drawerStatus, setDrawerStatus] = useState('');
    const [drawerNote, setDrawerNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [paymentFilter, setPaymentFilter] = useState('ALL');
    const [showCancelled, setShowCancelled] = useState(false);
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [sortBy, setSortBy] = useState('newest');
    const [density, setDensity] = useState(() => {
        if (typeof window === 'undefined') return 'comfortable';
        const saved = window.localStorage.getItem(DENSITY_STORAGE_KEY);
        return saved === 'compact' ? 'compact' : 'comfortable';
    });
    const [compactStages, setCompactStages] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = window.localStorage.getItem(COMPACT_STAGES_STORAGE_KEY);
        return saved !== 'off';
    });

    const hasAccess = hasPerm({ permissions }, PERMISSIONS.ORDERS_MANAGE);

    const showToast = (type, message) => {
        setToast({ type, message, id: Date.now() });
        setTimeout(() => setToast(null), 2600);
    };

    const loadOrders = useCallback(async () => {
        if (!token) return;
        const includeCancelled = showCancelled || statusFilter === 'CANCELLED';
        const backendStatus = statusFilter !== 'ALL'
            ? (statusFilter === 'CANCELLED' ? null : statusFilter)
            : null;

        setLoading(true);
        setError('');
        try {
            const list = await listAdminOrders(token, {
                includeCancelled,
                status: backendStatus,
                paymentStatus: paymentFilter !== 'ALL' ? paymentFilter : null,
                q: search.trim() || null,
                dateFrom: dateRange.from || null,
                dateTo: dateRange.to || null,
                sort: sortBy || null,
            });
            setOrders(list);
        } catch (err) {
            setError(err?.message || 'Unable to load orders');
        } finally {
            setLoading(false);
        }
    }, [dateRange.from, dateRange.to, paymentFilter, search, showCancelled, sortBy, statusFilter, token]);

    const loadOrderDetails = useCallback(async (orderId) => {
        if (!token || !orderId) return;
        setDetailsLoading(true);
        setDetailsError('');
        try {
            const details = await getAdminOrderDetails(token, orderId);
            setSelectedDetails(details);
            setOrders((prev) => prev.map((item) => (String(item.id) === String(details.id) ? { ...item, ...details } : item)));
        } catch (err) {
            setDetailsError(err?.message || 'Failed to load order details');
            setSelectedDetails(null);
        } finally {
            setDetailsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const selectedSummary = useMemo(() => orders.find((item) => String(item.id) === String(selectedId)) || null, [orders, selectedId]);
    const selectedOrder = selectedDetails && String(selectedDetails.id) === String(selectedId)
        ? selectedDetails
        : selectedSummary;
    const selectedOrderPayment = selectedOrder?.raw?.payment ?? {};
    const selectedOrderReadOnly = isCancelledByCustomer(selectedOrder);

    useEffect(() => {
        if (!selectedOrder) return;
        setDrawerStatus(normalizeKey(selectedOrder.status));
        setDrawerNote(selectedOrder.internalNotes || '');
    }, [selectedOrder]);

    useEffect(() => {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
    }, [density]);

    useEffect(() => {
        window.localStorage.setItem(COMPACT_STAGES_STORAGE_KEY, compactStages ? 'on' : 'off');
    }, [compactStages]);

    const filteredOrders = useMemo(() => {
        const query = search.trim().toLowerCase();
        let list = [...orders];

        if (query) {
            list = list.filter((order) => {
                const fields = [displayOrderNumber(order), order.customer?.name, order.customer?.email].map((value) => `${value || ''}`.toLowerCase());
                return fields.some((value) => value.includes(query));
            });
        }

        if (statusFilter !== 'ALL') {
            list = list.filter((order) => {
                if (statusFilter === 'CANCELLED') return isCancelledByCustomer(order);
                return normalizeKey(order.status) === statusFilter;
            });
        } else if (!showCancelled) {
            list = list.filter((order) => !isCancelledByCustomer(order));
        }

        if (paymentFilter !== 'ALL') {
            list = list.filter((order) => {
                const p = normalizeKey(order.paymentStatus);
                if (paymentFilter === 'PENDING') return !['PAID', 'PAYMENT_SUCCEEDED', 'FAILED', 'PAYMENT_FAILED'].includes(p);
                if (paymentFilter === 'FAILED') return ['FAILED', 'PAYMENT_FAILED'].includes(p);
                return ['PAID', 'PAYMENT_SUCCEEDED'].includes(p);
            });
        }

        list = list.filter((order) => filterDateRange(order.createdAt, dateRange));

        list.sort((a, b) => {
            if (sortBy === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            if (sortBy === 'total') return (b.totals?.total || 0) - (a.totals?.total || 0);
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        return list;
    }, [dateRange, orders, paymentFilter, search, showCancelled, sortBy, statusFilter]);

    const ordersByStatus = useMemo(() => {
        const groups = STATUS_OPTIONS.reduce((acc, status) => ({ ...acc, [status]: [] }), {});
        filteredOrders.forEach((order) => {
            const key = normalizeBoardStatus(order.status);
            if (groups[key]) {
                groups[key].push(order);
            }
        });
        return groups;
    }, [filteredOrders]);

    const boardColumns = useMemo(() => {
        if (compactStages) {
            return [
                { key: 'RECEIVED', label: 'Received', orders: ordersByStatus.RECEIVED || [] },
                {
                    key: 'IN_PROGRESS',
                    label: 'In progress',
                    orders: [
                        ...(ordersByStatus.PREPARING || []),
                        ...(ordersByStatus.SHIPPING || []),
                        ...(ordersByStatus.READY_FOR_PICKUP || []),
                    ],
                },
                {
                    key: 'DONE',
                    label: 'Done',
                    orders: [
                        ...(ordersByStatus.DELIVERED || []),
                        ...(ordersByStatus.CANCELLED || []),
                    ],
                },
            ];
        }

        return STATUS_OPTIONS.map((status) => ({
            key: status,
            label: status === 'CANCELLED' ? 'Cancelled' : status.replaceAll('_', ' '),
            orders: ordersByStatus[status] || [],
        }));
    }, [compactStages, ordersByStatus]);

    const canTransition = (from, to, order) => {
        const fromKey = normalizeKey(from);
        const toKey = normalizeKey(to);
        if (fromKey === toKey) return true;
        if (fromKey === 'PREPARING') {
            const allowed = isPickupOrder(order) ? ['READY_FOR_PICKUP'] : ['SHIPPING'];
            return allowed.includes(toKey);
        }
        return (ALLOWED_TRANSITIONS[fromKey] || []).includes(toKey);
    };

    const handleOpenOrder = (orderId) => {
        setSelectedId(orderId);
        setSelectedDetails(null);
        setDetailsError('');
        loadOrderDetails(orderId);
    };

    const handleRetryDetails = () => {
        if (!selectedId) return;
        loadOrderDetails(selectedId);
    };

    const handleCopy = async (value, label) => {
        try {
            const text = String(value || '').trim();
            if (!text) {
                showToast('error', `No ${label} to copy.`);
                return;
            }
            await navigator.clipboard.writeText(text);
            showToast('success', `${label} copied.`);
        } catch {
            showToast('error', 'Clipboard is unavailable.');
        }
    };

    const handleSaveStatus = async () => {
        if (!selectedOrder || !drawerStatus || selectedOrderReadOnly) return;
        const previous = selectedOrder;
        if (!canTransition(previous.status, drawerStatus, selectedOrder)) {
            showToast('error', 'Invalid status transition for this order.');
            return;
        }

        const paymentKey = normalizeKey(selectedOrder.paymentStatus);
        if (drawerStatus === 'DELIVERED' && ['FAILED', 'PAYMENT_FAILED', 'PENDING', 'PENDING_PAYMENT'].includes(paymentKey)) {
            const approved = window.confirm('Payment is pending/failed. Are you sure you want to mark this order as delivered?');
            if (!approved) return;
        }

        const optimistic = { ...selectedOrder, status: drawerStatus, internalNotes: drawerNote };
        setOrders((prev) => prev.map((item) => (String(item.id) === String(optimistic.id) ? optimistic : item)));
        setSelectedDetails((prev) => (prev && String(prev.id) === String(optimistic.id) ? optimistic : prev));
        setSaving(true);
        try {
            const persisted = await updateAdminOrderStatus(token, selectedOrder.id, drawerStatus, { note: drawerNote });
            setOrders((prev) => prev.map((item) => (String(item.id) === String(persisted.id) ? { ...item, ...persisted } : item)));
            setSelectedDetails((prev) => (prev && String(prev.id) === String(persisted.id) ? { ...prev, ...persisted } : prev));
            showToast('success', 'Order status updated.');
        } catch (err) {
            setOrders((prev) => prev.map((item) => (String(item.id) === String(previous.id) ? previous : item)));
            setSelectedDetails((prev) => (prev && String(prev.id) === String(previous.id) ? previous : prev));
            showToast('error', err?.message || 'Failed to update order status.');
        } finally {
            setSaving(false);
        }
    };

    const readOnlyMessage = selectedOrderReadOnly ? 'Cancelled by customer (read-only).' : '';
    const isCompact = density === 'compact';

    if (!hasAccess) {
        return <div className={styles.noAccess}>You need Orders Manage permission to view this page.</div>;
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>Orders</h1>
                <p>Track every order, payment, and fulfillment status in one place.</p>
            </header>

            <section className={styles.filtersRow}>
                <input className={styles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search #, email, or customer" />
                <select className={styles.statusSelect} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="ALL">All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status === 'CANCELLED' ? 'Cancelled' : status.replaceAll('_', ' ')}</option>
                    ))}
                </select>
                <select className={styles.filterSelect} value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                    {PAYMENT_FILTERS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <input className={styles.filterSelect} type="date" value={dateRange.from} onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))} />
                <input className={styles.filterSelect} type="date" value={dateRange.to} onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))} />
                <select className={styles.filterSelect} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="total">Total</option>
                </select>
                <label className={styles.toggleLabel}>
                    <input type="checkbox" checked={showCancelled} onChange={(event) => setShowCancelled(event.target.checked)} />
                    Show cancelled orders
                </label>
                <div className={styles.densityToggle} role="group" aria-label="Card density">
                    <button type="button" className={`${styles.densityBtn} ${!isCompact ? styles.densityBtnActive : ''}`} onClick={() => setDensity('comfortable')}>Comfortable</button>
                    <button type="button" className={`${styles.densityBtn} ${isCompact ? styles.densityBtnActive : ''}`} onClick={() => setDensity('compact')}>Compact</button>
                </div>
                <label className={styles.toggleLabel}>
                    <input type="checkbox" checked={compactStages} onChange={(event) => setCompactStages(event.target.checked)} />
                    Compact stages
                </label>
            </section>

            {error ? <div className={styles.error}>{error}</div> : null}

            <div className={`${styles.boardWrap} ${compactStages ? styles.boardWrapCompact : ''} ${selectedOrder ? styles.boardWrapWithDrawer : ''}`}>
                <div className={`${styles.board} ${compactStages ? styles.boardCompact : ''}`}>
                    {boardColumns.map((column) => {
                        const columnOrders = column.orders || [];
                        return (
                            <section key={column.key} className={styles.column}>
                                <header className={styles.columnHeader}>
                                    <h3>{column.label}</h3>
                                    <span>{columnOrders.length}</span>
                                </header>
                                <div className={styles.columnContent}>
                                    {loading ? (
                                        Array.from({ length: 4 }, (_, index) => <div key={`${column.key}-loading-${index}`} className={styles.skeletonCard} />)
                                    ) : columnOrders.length === 0 ? (
                                        <p className={styles.empty}>No orders</p>
                                    ) : columnOrders.map((order) => {
                                        const paymentLabel = paymentBadgeText(order);
                                        return (
                                            <article key={order.id} className={`${styles.orderCard} ${isCompact ? styles.orderCardCompact : ''} ${isCancelledByCustomer(order) ? styles.rowCancelled : ''}`}>
                                                <p className={styles.cardOrder}>#{displayOrderNumber(order)}</p>
                                                <p className={styles.cardCustomer} title={toDisplayValue(order.customer?.name)}>{toDisplayValue(order.customer?.name)}</p>
                                                <p className={styles.cardTotal}>{formatCurrency(order.totals?.total || 0, order.totals?.currency || 'SEK')}</p>
                                                <div className={styles.cardBadges}>
                                                    <span className={`${styles.badge} ${statusBadgeClass(order.status)}`}>Status: {formatStatusBadge(order.status)}</span>
                                                    <span className={`${styles.badge} ${paymentColorClass(paymentLabel)}`}>Payment: {paymentLabel}</span>
                                                    {!isCompact ? <span className={`${styles.badge} ${deliveryColorClass(order)}`}>Delivery: {deliveryBadgeText(order)}</span> : null}
                                                </div>
                                                {!isCompact ? <p className={styles.muted}>{order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</p> : null}
                                                <button type="button" onClick={() => handleOpenOrder(order.id)} className={styles.openBtn}>Open</button>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            <aside className={`${styles.drawer} ${selectedOrder ? styles.drawerOpen : ''}`}>
                {selectedOrder ? (
                    <>
                        <div className={styles.drawerHeader}>
                            <h2>Order #{displayOrderNumber(selectedOrder)}</h2>
                            <button type="button" onClick={() => setSelectedId(null)}>Close</button>
                        </div>

                        <div className={styles.drawerContent}>
                            {detailsError ? (
                                <div className={styles.detailsErrorBox}>
                                    <p>Failed to load order details.</p>
                                    <button type="button" onClick={handleRetryDetails}>Retry</button>
                                </div>
                            ) : null}

                            {detailsLoading ? (
                                <div className={styles.drawerLoading}>
                                    <div className={styles.drawerSkeleton} />
                                    <div className={styles.drawerSkeleton} />
                                    <div className={styles.drawerSkeleton} />
                                </div>
                            ) : null}

                            {!detailsLoading ? (
                                <>
                                    <section className={styles.section}>
                                        <h4>Order</h4>
                                        <div className={styles.row}><span>Order #</span><span>{displayOrderNumber(selectedOrder)}</span><button type="button" onClick={() => handleCopy(displayOrderNumber(selectedOrder), 'Order number')}>Copy</button></div>
                                        <div className={styles.row}><span>Order ID</span><span className={styles.mono}>{toDisplayValue(selectedOrder.id)}</span><button type="button" onClick={() => handleCopy(selectedOrder.id, 'Order ID')}>Copy</button></div>
                                        <div className={styles.row}><span>Created</span><span>{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : '—'}</span></div>
                                        <div className={styles.row}><span>Updated</span><span>{selectedOrder.updatedAt ? new Date(selectedOrder.updatedAt).toLocaleString() : '—'}</span></div>
                                        <div className={styles.row}><span>Status</span><span>{formatStatusBadge(selectedOrder.status)}</span></div>
                                        <div className={styles.statusRow}>
                                            <select value={drawerStatus} onChange={(event) => setDrawerStatus(event.target.value)} disabled={selectedOrderReadOnly || saving}>
                                                {STATUS_OPTIONS.map((status) => (
                                                    <option key={status} value={status} disabled={!canTransition(selectedOrder.status, status, selectedOrder)}>{status.replaceAll('_', ' ')}</option>
                                                ))}
                                            </select>
                                            <button type="button" onClick={handleSaveStatus} disabled={selectedOrderReadOnly || saving}>{saving ? 'Saving…' : 'Save'}</button>
                                        </div>
                                    </section>

                                    {readOnlyMessage ? <p className={styles.cancelledWarning}>{readOnlyMessage}</p> : null}

                                    <section className={styles.section}>
                                        <h4>Payment</h4>
                                        <div className={styles.row}><span>Status</span><span>{toDisplayValue(selectedOrder.paymentStatus)}</span></div>
                                        <div className={styles.row}><span>Mode</span><span>{toDisplayValue(selectedOrder.paymentMode || 'PAY_NOW')}</span></div>
                                        <div className={styles.row}><span>Method</span><span>{toDisplayValue(selectedOrder.paymentMethod ?? selectedOrderPayment?.method)}</span></div>
                                        <div className={styles.row}><span>Reference</span><span>{toDisplayValue(selectedOrder.paymentReference ?? selectedOrderPayment?.reference)}</span></div>
                                    </section>

                                    <section className={styles.section}>
                                        <h4>Customer</h4>
                                        <div className={styles.row}><span>Name</span><span>{toDisplayValue(selectedOrder.customer?.name)}</span></div>
                                        <div className={styles.row}><span>Email</span><span>{toDisplayValue(selectedOrder.customer?.email)}</span></div>
                                        <div className={styles.row}><span>Phone</span><span>{toDisplayValue(selectedOrder.customer?.phone)}</span></div>
                                    </section>

                                    <section className={styles.section}>
                                        <h4>Fulfillment</h4>
                                        <div className={styles.row}><span>Type</span><span>{isPickupOrder(selectedOrder) ? 'Pickup' : 'Shipping'}</span></div>
                                        {isPickupOrder(selectedOrder) ? (
                                            <div className={styles.row}><span>Location</span><span>{toDisplayValue(selectedOrder.pickupLocation)}</span></div>
                                        ) : (
                                            <>
                                                {toAddressLines(selectedOrder.shippingAddress).length > 0 ? toAddressLines(selectedOrder.shippingAddress).map((line) => (
                                                    <div className={styles.row} key={line}><span>Address</span><span>{line}</span></div>
                                                )) : <div className={styles.row}><span>Address</span><span>—</span></div>}
                                            </>
                                        )}
                                    </section>

                                    <section className={styles.section}>
                                        <h4>Items</h4>
                                        {(selectedOrder.items || []).map((item) => (
                                            <div key={item.id} className={styles.lineItem}>
                                                <span>{item.name} × {item.quantity}</span>
                                                <span>{formatCurrency(item.lineTotal, selectedOrder.totals?.currency || 'SEK')}</span>
                                            </div>
                                        ))}
                                    </section>

                                    <section className={styles.section}>
                                        <h4>Totals</h4>
                                        <div className={styles.lineItem}><span>Subtotal</span><span>{formatCurrency(selectedOrder.totals?.subtotal || 0, selectedOrder.totals?.currency || 'SEK')}</span></div>
                                        {(selectedOrder.totals?.shipping ?? 0) > 0 ? <div className={styles.lineItem}><span>Shipping</span><span>{formatCurrency(selectedOrder.totals?.shipping || 0, selectedOrder.totals?.currency || 'SEK')}</span></div> : null}
                                        {(selectedOrder.totals?.tax ?? 0) > 0 ? <div className={styles.lineItem}><span>VAT</span><span>{formatCurrency(selectedOrder.totals?.tax || 0, selectedOrder.totals?.currency || 'SEK')}</span></div> : null}
                                        <div className={styles.lineItem}><span>Total</span><span>{formatCurrency(selectedOrder.totals?.total || 0, selectedOrder.totals?.currency || 'SEK')}</span></div>
                                        <div className={styles.lineItem}><span>Paid</span><span>{normalizeKey(selectedOrder.paymentStatus) === 'PAID' ? formatCurrency(selectedOrder.totals?.total || 0, selectedOrder.totals?.currency || 'SEK') : '—'}</span></div>
                                    </section>

                                    <section className={styles.section}>
                                        <h4>Internal notes</h4>
                                        <textarea value={drawerNote} onChange={(event) => setDrawerNote(event.target.value)} rows={4} disabled={selectedOrderReadOnly} />
                                    </section>
                                </>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <div className={styles.drawerPlaceholder}>Open an order to see details.</div>
                )}
            </aside>

            {toast ? <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>{toast.message}</div> : null}
        </div>
    );
}
