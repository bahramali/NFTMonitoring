import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listAdminOrders, updateAdminOrderStatus } from '../../api/adminOrders.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../utils/currency.js';
import { PERMISSIONS, hasPerm } from '../../utils/permissions.js';
import styles from './AdminOrders.module.css';

const STATUS_OPTIONS = ['RECEIVED', 'PREPARING', 'SHIPPING', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED'];
const PAYMENT_FILTERS = ['ALL', 'PAID', 'PENDING', 'FAILED'];
const DENSITY_STORAGE_KEY = 'admin-orders-board-density';

const normalizeKey = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

const isPickupOrder = (order) => normalizeKey(order?.fulfillmentType).includes('PICKUP');
const isCancelledStatus = (value) => ['CANCELLED_BY_CUSTOMER', 'CANCELLED'].includes(normalizeKey(value));
const isCancelledByCustomer = (order) => isCancelledStatus(order?.status);
const normalizeBoardStatus = (status) => (isCancelledStatus(status) ? 'CANCELLED' : normalizeKey(status));

const deliveryBadgeText = (order) => (isPickupOrder(order) ? 'Pickup' : 'Shipping');

const statusBadgeClass = (status) => {
    const key = normalizeKey(status);
    if (['DELIVERED', 'COMPLETED'].includes(key)) return styles.badgeGreen;
    if (['CANCELLED_BY_CUSTOMER', 'CANCELLED'].includes(key)) return styles.badgeRed;
    if (['SHIPPING', 'READY_FOR_PICKUP', 'IN_TRANSIT'].includes(key)) return styles.badgeBlue;
    return styles.badgeNeutral;
};

const paymentColorClass = (status) => {
    const key = normalizeKey(status);
    if (['PAID', 'PAYMENT_SUCCEEDED'].includes(key)) return styles.badgeGreen;
    if (['FAILED', 'PAYMENT_FAILED'].includes(key)) return styles.badgeRed;
    return styles.badgeYellow;
};

const summarizeAddress = (order) => {
    if (isPickupOrder(order)) {
        return `Pickup: ${order?.pickupLocation || 'Stockholm'}`;
    }
    const addr = order?.shippingAddress;
    const pieces = [addr?.city, addr?.postalCode].filter(Boolean);
    return pieces.join(' ') || 'Shipping address unavailable';
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

const displayPaymentValue = (value) => {
    if (value == null) return 'Unknown';
    const normalized = String(value).trim();
    return normalized || 'Unknown';
};

export default function AdminOrders() {
    const { token, permissions } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
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

    const hasAccess = hasPerm({ permissions }, PERMISSIONS.ORDERS_MANAGE);

    const loadOrders = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const list = await listAdminOrders(token);
            setOrders(list);
        } catch (err) {
            setError(err?.message || 'Unable to load orders');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const selectedOrder = useMemo(() => orders.find((item) => String(item.id) === String(selectedId)) || null, [orders, selectedId]);
    const selectedOrderPayment = selectedOrder?.raw?.payment ?? {};
    const selectedOrderReadOnly = isCancelledByCustomer(selectedOrder);
    const paymentMethod = displayPaymentValue(selectedOrder?.paymentMethod ?? selectedOrderPayment?.method);
    const paymentReference = displayPaymentValue(selectedOrder?.paymentReference ?? selectedOrderPayment?.reference);

    useEffect(() => {
        if (!selectedOrder) return;
        setDrawerStatus(normalizeKey(selectedOrder.status));
        setDrawerNote(selectedOrder.internalNotes || '');
    }, [selectedOrder]);

    const filteredOrders = useMemo(() => {
        const query = search.trim().toLowerCase();
        let list = [...orders];

        if (query) {
            list = list.filter((order) => {
                const fields = [order.orderNumber, order.customer?.name, order.customer?.email].map((value) => `${value || ''}`.toLowerCase());
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

    useEffect(() => {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
    }, [density]);

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

    const showToast = (type, message) => {
        setToast({ type, message, id: Date.now() });
        setTimeout(() => setToast(null), 2600);
    };

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
        setOrders((prev) => prev.map((item) => (item.id === optimistic.id ? optimistic : item)));
        setSaving(true);
        try {
            const persisted = await updateAdminOrderStatus(token, selectedOrder.id, drawerStatus, { note: drawerNote });
            setOrders((prev) => prev.map((item) => (item.id === persisted.id ? { ...item, ...persisted } : item)));
            showToast('success', 'Order status updated.');
        } catch (err) {
            setOrders((prev) => prev.map((item) => (item.id === previous.id ? previous : item)));
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
                    <button
                        type="button"
                        className={`${styles.densityBtn} ${!isCompact ? styles.densityBtnActive : ''}`}
                        onClick={() => setDensity('comfortable')}
                    >
                        Comfortable
                    </button>
                    <button
                        type="button"
                        className={`${styles.densityBtn} ${isCompact ? styles.densityBtnActive : ''}`}
                        onClick={() => setDensity('compact')}
                    >
                        Compact
                    </button>
                </div>
            </section>

            {error ? <div className={styles.error}>{error}</div> : null}

            <div className={styles.boardWrap}>
                <div className={styles.board}>
                    {STATUS_OPTIONS.map((status) => {
                        const columnOrders = ordersByStatus[status] || [];
                        return (
                            <section key={status} className={styles.column}>
                                <header className={styles.columnHeader}>
                                    <h3>{status === 'CANCELLED' ? 'Cancelled' : status.replaceAll('_', ' ')}</h3>
                                    <span>{columnOrders.length}</span>
                                </header>
                                <div className={styles.columnContent}>
                                    {loading ? (
                                        Array.from({ length: 4 }, (_, index) => (
                                            <div key={`${status}-loading-${index}`} className={styles.skeletonCard} />
                                        ))
                                    ) : columnOrders.length === 0 ? (
                                        <p className={styles.empty}>No orders</p>
                                    ) : columnOrders.map((order) => (
                                        <article
                                            key={order.id}
                                            className={`${styles.orderCard} ${isCompact ? styles.orderCardCompact : ''} ${isCancelledByCustomer(order) ? styles.rowCancelled : ''}`}
                                        >
                                            <p className={styles.cardOrder}>#{order.orderNumber}</p>
                                            <p className={styles.cardCustomer} title={order.customer?.name || 'Unknown'}>{order.customer?.name || 'Unknown'}</p>
                                            <p className={styles.cardTotal}>{formatCurrency(order.totals?.total || 0, order.totals?.currency || 'SEK')}</p>
                                            <div className={styles.cardBadges}>
                                                <span className={`${styles.badge} ${statusBadgeClass(order.status)}`}>{normalizeKey(order.status)}</span>
                                                <span className={`${styles.badge} ${paymentColorClass(order.paymentStatus)}`}>{normalizeKey(order.paymentStatus)}</span>
                                                {!isCompact ? <span className={`${styles.badge} ${styles.badgeNeutral}`}>{deliveryBadgeText(order)}</span> : null}
                                            </div>
                                            {!isCompact ? <p className={styles.muted}>{order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</p> : null}
                                            <button type="button" onClick={() => setSelectedId(order.id)} className={styles.openBtn}>Open</button>
                                        </article>
                                    ))}
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
                            <h2>Order #{selectedOrder.orderNumber}</h2>
                            <button type="button" onClick={() => setSelectedId(null)}>Close</button>
                        </div>

                        <section className={styles.section}>
                            <h4>Status</h4>
                            <div className={styles.statusRow}>
                                <select value={drawerStatus} onChange={(event) => setDrawerStatus(event.target.value)} disabled={selectedOrderReadOnly || saving}>
                                    {STATUS_OPTIONS.map((status) => (
                                        <option
                                            key={status}
                                            value={status}
                                            disabled={!canTransition(selectedOrder.status, status, selectedOrder)}
                                        >
                                            {status.replaceAll('_', ' ')}
                                        </option>
                                    ))}
                                </select>
                                <button type="button" onClick={handleSaveStatus} disabled={selectedOrderReadOnly || saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </section>

                        {readOnlyMessage ? <p className={styles.cancelledWarning}>{readOnlyMessage}</p> : null}

                        <section className={styles.section}>
                            <h4>Payment</h4>
                            <p>Status: <strong>{normalizeKey(selectedOrder.paymentStatus)}</strong></p>
                            <p><strong>Payment mode:</strong> {selectedOrder.paymentMode || 'PAY_NOW'}</p>
                            <p><strong>Invoice status:</strong> {selectedOrder.invoiceStatus || '—'}</p>
                            <p><strong>Payment Method:</strong> {paymentMethod}</p>
                            <p><strong>Reference:</strong> {paymentReference}</p>
                            {normalizeKey(selectedOrder.paymentStatus) === 'PAID' && (!selectedOrder.paymentReference || !selectedOrder.paymentMethod) ? (
                                <p className={styles.paymentWarning}>Payment confirmed, but provider details are not available yet.</p>
                            ) : null}
                        </section>

                        <section className={styles.section}>
                            <h4>Customer</h4>
                            <p>{selectedOrder.customer?.name || '—'}</p>
                            <p>{selectedOrder.customer?.email || '—'}</p>
                            <p>{selectedOrder.customer?.phone || '—'}</p>
                        </section>

                        <section className={styles.section}>
                            <h4>Fulfillment</h4>
                            <p>{isPickupOrder(selectedOrder) ? 'Pickup' : 'Shipping'}</p>
                            <p>{summarizeAddress(selectedOrder)}</p>
                        </section>

                        <section className={styles.section}>
                            <h4>Items</h4>
                            {selectedOrder.items.map((item) => (
                                <div key={item.id} className={styles.lineItem}>
                                    <span>{item.name} × {item.quantity}</span>
                                    <span>{formatCurrency(item.lineTotal, selectedOrder.totals?.currency || 'SEK')}</span>
                                </div>
                            ))}
                            <div className={styles.lineItem}><span>Subtotal (excl. VAT / Net)</span><span>{formatCurrency(Math.max((selectedOrder.totals?.subtotal || 0) - (selectedOrder.totals?.tax || 0), 0), selectedOrder.totals?.currency || 'SEK')}</span></div>
                            <div className={styles.lineItem}><span>Shipping</span><span>{formatCurrency(selectedOrder.totals?.shipping || 0, selectedOrder.totals?.currency || 'SEK')}</span></div>
                            <div className={styles.lineItem}><span>VAT (moms)</span><span>{formatCurrency(selectedOrder.totals?.tax || 0, selectedOrder.totals?.currency || 'SEK')}</span></div>
                            <div className={styles.lineItem}><span>Total (incl. VAT / Gross)</span><span>{formatCurrency(selectedOrder.totals?.total || 0, selectedOrder.totals?.currency || 'SEK')}</span></div>
                        </section>

                        <section className={styles.section}>
                            <h4>Internal notes</h4>
                            <textarea value={drawerNote} onChange={(event) => setDrawerNote(event.target.value)} rows={4} disabled={selectedOrderReadOnly} />
                        </section>
                    </>
                ) : (
                    <div className={styles.drawerPlaceholder}>Open an order to see details.</div>
                )}
            </aside>

            {toast ? <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>{toast.message}</div> : null}
        </div>
    );
}
