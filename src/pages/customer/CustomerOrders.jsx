import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { cancelMyOrder } from '../../api/customer.js';
import OrderRow from '../../components/orders/OrderRow.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useRedirectToLogin from '../../hooks/useRedirectToLogin.js';
import { canCancelOrder } from './orderUtils.js';
import styles from './CustomerOrders.module.css';

const toStatusKey = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '_');

export default function CustomerOrders() {
    const { token } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const { ordersState, loadOrders } = useOutletContext();
    const [localError, setLocalError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('newest');
    const [cancelState, setCancelState] = useState({ loadingOrderId: '', error: '', success: '' });

    const handleLoadOrders = useCallback(
        (options = {}) =>
            loadOrders(options).catch((error) => {
                if (error?.name === 'AbortError') return;
                setLocalError(error?.message || 'Failed to load orders');
            }),
        [loadOrders],
    );

    useEffect(() => {
        if (ordersState.supported === false || ordersState.rateLimited || ordersState.hasFetched) return undefined;
        const controller = new AbortController();
        handleLoadOrders({ signal: controller.signal });
        return () => controller.abort();
    }, [handleLoadOrders, ordersState.hasFetched, ordersState.rateLimited, ordersState.supported]);

    const handleCancelOrder = useCallback(async (order) => {
        if (!token || !order?.id) return;
        setCancelState({ loadingOrderId: String(order.id), error: '', success: '' });
        try {
            await cancelMyOrder(token, order.id, { onUnauthorized: redirectToLogin });
            await handleLoadOrders({ silent: true });
            setCancelState({ loadingOrderId: '', error: '', success: `Order #${order.id} cancelled.` });
        } catch (error) {
            setCancelState({
                loadingOrderId: '',
                error: error?.message || 'Could not cancel the order right now.',
                success: '',
            });
        }
    }, [handleLoadOrders, redirectToLogin, token]);

    const sortedOrders = useMemo(() => {
        let list = [...(ordersState.items || [])];
        if (statusFilter !== 'ALL') {
            list = list.filter((order) => toStatusKey(order.status) === statusFilter);
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((order) => String(order.id || '').toLowerCase().includes(q));
        }
        list.sort((a, b) => {
            const delta = Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);
            return sort === 'oldest' ? delta : -delta;
        });
        return list;
    }, [ordersState.items, search, sort, statusFilter]);

    if (ordersState.supported === false) {
        return <div className={styles.card}><h1>Orders unavailable</h1><Link to="/account">Back to account</Link></div>;
    }

    return (
        <div className={styles.card}>
            <div className={styles.header}><h1>My orders</h1></div>
            <div className={styles.filters}>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="ALL">All statuses</option>
                    <option value="PAID">Paid</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="COMPLETED">Completed</option>
                </select>
                <input
                    type="search"
                    placeholder="Search by order number"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                </select>
            </div>

            {(localError || ordersState.error || cancelState.error) ? (
                <p className={styles.error}>{localError || ordersState.error || cancelState.error}</p>
            ) : null}
            {cancelState.success ? <p className={styles.success}>{cancelState.success}</p> : null}

            <div className={styles.tableHeader}>
                <span>Order</span><span>Total</span><span>Status</span><span>Actions</span>
            </div>
            <div className={styles.list}>
                {!ordersState.loading && sortedOrders.length === 0 ? <p className={styles.empty}>No orders found.</p> : null}
                {sortedOrders.map((order) => (
                    <OrderRow
                        key={order.id}
                        order={order}
                        detailsTo={`/account/orders/${encodeURIComponent(order.id)}`}
                        receiptAvailable={['PAID', 'COMPLETED'].includes(toStatusKey(order.status))}
                        canCancel={canCancelOrder(order.status)}
                        cancelLoading={cancelState.loadingOrderId === String(order.id)}
                        onCancel={handleCancelOrder}
                    />
                ))}
            </div>
        </div>
    );
}
