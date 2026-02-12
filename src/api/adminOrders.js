import { authFetch, parseApiResponse } from './http.js';
import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const ADMIN_ORDERS_URL = `${API_BASE}/api/admin/store/orders`;
const isDev = import.meta.env?.MODE === 'development';

const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const mockOrders = [
    {
        id: 'ord_1001',
        orderNumber: '1001',
        createdAt: new Date().toISOString(),
        status: 'RECEIVED',
        paymentStatus: 'PAID',
        paymentReference: 'pi_43JKS',
        paymentMethod: 'Card',
        customer: { name: 'Alex Karlsson', email: 'alex@example.com', phone: '+46701234567' },
        fulfillmentType: 'SHIPPING',
        shippingAddress: { line1: 'Kammakargatan 12', city: 'Solna', postalCode: '16974', country: 'Sweden' },
        items: [{ id: 'li_1', name: 'Genovese Basil 50g', quantity: 2, unitPrice: 39, lineTotal: 78 }],
        totals: { subtotal: 78, shipping: 49, tax: 0, discount: 0, total: 127, currency: 'SEK' },
        internalNotes: '',
    },
];

const shouldUseMockFallback = (error) => {
    if (!isDev) return false;
    const status = error?.status ?? error?.response?.status;
    return !status || status === 404 || status === 501;
};


const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const resolveAmount = (amount, amountCents) => {
    const cents = toNumber(amountCents);
    if (cents !== null) return cents / 100;
    const decimal = toNumber(amount);
    return decimal ?? 0;
};

const asArray = (payload, ...keys) => {
    for (const key of keys) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return Array.isArray(payload) ? payload : [];
};

const normalizeAddress = (address) => {
    if (!address) return null;
    if (typeof address === 'string') return { line1: address };
    return {
        line1: address.line1 ?? address.address1 ?? '',
        line2: address.line2 ?? address.address2 ?? '',
        city: address.city ?? '',
        state: address.state ?? address.province ?? '',
        postalCode: address.postalCode ?? address.zip ?? '',
        country: address.country ?? '',
    };
};

const normalizeItems = (items) => {
    const list = Array.isArray(items) ? items : [];
    return list.map((item, index) => {
        const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1;
        const unitPrice = resolveAmount(item?.unitPrice ?? item?.price ?? item?.amount, item?.unitPriceCents ?? item?.priceCents ?? item?.amountCents);
        const lineTotal = resolveAmount(item?.lineTotal ?? item?.total, item?.lineTotalCents ?? item?.totalCents) || (quantity * unitPrice);
        return {
            id: item?.id ?? item?.lineId ?? `${index}`,
            name: item?.name ?? item?.title ?? item?.sku ?? 'Item',
            quantity,
            unitPrice,
            lineTotal,
            sku: item?.sku ?? '',
        };
    });
};

export const normalizeAdminOrder = (order = {}) => {
    const id = order?.id ?? order?.orderId ?? order?._id ?? order?.orderNumber ?? '';
    const items = normalizeItems(order?.items ?? order?.lineItems ?? order?.lines);
    const subtotalFallback = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totals = order?.totals ?? order?.summary ?? order?.amounts ?? {};
    const customer = order?.customer ?? order?.customerInfo ?? {};
    const payment = order?.payment ?? {};
    const fulfillment = order?.fulfillment ?? {};
    const explicitFulfillment = order?.fulfillmentType ?? order?.deliveryType ?? fulfillment?.type;
    const fulfillmentType = explicitFulfillment
        ? String(explicitFulfillment)
        : order?.shippingAddress
            ? 'SHIPPING'
            : 'PICKUP';

    return {
        id,
        orderNumber: order?.orderNumber ?? order?.displayOrderNumber ?? id,
        createdAt: order?.createdAt ?? order?.placedAt ?? order?.date ?? '',
        status: order?.status ?? order?.deliveryStatus ?? order?.fulfillmentStatus ?? 'RECEIVED',
        paymentStatus: order?.paymentStatus ?? payment?.status ?? order?.status ?? 'PENDING',
        paymentReference: payment?.reference ?? payment?.id ?? order?.paymentReference ?? '',
        paymentMethod: payment?.method ?? order?.paymentMethod ?? '',
        customer: {
            name: customer?.name ?? customer?.fullName ?? order?.customerName ?? '',
            email: customer?.email ?? order?.email ?? '',
            phone: customer?.phone ?? order?.phone ?? '',
        },
        fulfillmentType,
        pickupLocation: fulfillment?.pickupLocation ?? order?.pickupLocation ?? '',
        shippingAddress: normalizeAddress(order?.shippingAddress ?? order?.address ?? fulfillment?.address),
        billingAddress: normalizeAddress(order?.billingAddress ?? payment?.billingAddress),
        items,
        totals: {
            subtotal: resolveAmount(order?.subtotal ?? totals?.subtotal, order?.subtotalCents ?? totals?.subtotalCents) || subtotalFallback,
            shipping: resolveAmount(order?.shipping ?? totals?.shipping ?? totals?.shippingTotal, order?.shippingCents ?? totals?.shippingCents),
            tax: resolveAmount(order?.tax ?? totals?.tax ?? totals?.taxTotal, order?.taxCents ?? totals?.taxCents),
            discount: resolveAmount(order?.discount ?? totals?.discount, order?.discountCents ?? totals?.discountCents),
            total: resolveAmount(order?.paidTotal ?? order?.total ?? totals?.total, order?.paidTotalCents ?? order?.totalCents ?? totals?.totalCents) || subtotalFallback,
            currency: order?.currency ?? totals?.currency ?? 'SEK',
        },
        internalNotes: order?.internalNotes ?? order?.adminNote ?? '',
        raw: order,
    };
};

export async function listAdminOrders(token, { signal } = {}) {
    const candidates = [
        `${ADMIN_ORDERS_URL}`,
        `${API_BASE}/api/admin/orders`,
        `${API_BASE}/api/store/admin/orders`,
    ];

    let lastError = null;
    for (const url of candidates) {
        try {
            const res = await authFetch(url, { method: 'GET', headers: authHeaders(token), signal }, { token });
            const payload = await parseApiResponse(res, 'Failed to load orders');
            const list = asArray(payload, 'orders', 'data', 'items');
            return list.map(normalizeAdminOrder);
        } catch (error) {
            lastError = error;
        }
    }

    if (shouldUseMockFallback(lastError)) {
        return mockOrders.map(normalizeAdminOrder);
    }
    throw lastError || new Error('Failed to load orders');
}

export async function updateAdminOrderStatus(token, orderId, status, { note } = {}) {
    if (!orderId) throw new Error('Order ID is required');
    if (!status) throw new Error('Status is required');

    const payload = { status, ...(note ? { note } : {}) };
    const candidates = [
        `${ADMIN_ORDERS_URL}/${encodeURIComponent(orderId)}/status`,
        `${API_BASE}/api/admin/orders/${encodeURIComponent(orderId)}/status`,
    ];

    let lastError = null;
    for (const url of candidates) {
        try {
            const res = await authFetch(
                url,
                {
                    method: 'PATCH',
                    headers: authHeaders(token),
                    body: JSON.stringify(payload),
                },
                { token },
            );
            const data = await parseApiResponse(res, 'Failed to update order status');
            return normalizeAdminOrder(data?.order ?? data ?? { id: orderId, status });
        } catch (error) {
            lastError = error;
        }
    }

    if (shouldUseMockFallback(lastError)) {
        const match = mockOrders.find((item) => String(item.id) === String(orderId));
        if (match) {
            match.status = status;
            if (note != null) match.internalNotes = note;
            return normalizeAdminOrder(match);
        }
        return normalizeAdminOrder({ id: orderId, status });
    }

    throw lastError || new Error('Failed to update order status');
}
