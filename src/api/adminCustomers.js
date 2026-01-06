import { authFetch, buildAuthHeaders, parseApiResponse } from './http.js';

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? 'https://api.hydroleaf.se';
const ADMIN_CUSTOMERS_URL = `${API_BASE}/api/admin/customers`;

const normalizeStatus = (status) => {
    if (!status) return '';
    const normalized = `${status}`.trim();
    if (!normalized) return '';
    const lowered = normalized.toLowerCase();
    if (lowered === 'active') return 'Active';
    if (lowered === 'inactive') return 'Inactive';
    if (lowered === 'at_risk' || lowered === 'atrisk' || lowered === 'at risk') return 'At risk';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizeCustomerType = (type) => {
    if (!type) return '';
    const normalized = `${type}`.trim();
    if (!normalized) return '';
    const lowered = normalized.toLowerCase();
    if (lowered === 'wholesale') return 'Wholesale';
    if (lowered === 'retail') return 'Retail';
    if (lowered === 'subscriber' || lowered === 'subscription') return 'Subscriber';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const joinName = (customer) => {
    const name = customer?.name ?? customer?.fullName;
    if (name) return name;
    const first = customer?.firstName ?? customer?.givenName;
    const last = customer?.lastName ?? customer?.familyName;
    return [first, last].filter(Boolean).join(' ');
};

const describeOrderItems = (order) => {
    if (!order) return '';
    if (typeof order.items === 'string') return order.items;
    if (typeof order.itemsSummary === 'string') return order.itemsSummary;
    if (typeof order.summary === 'string') return order.summary;
    const items = Array.isArray(order.items) ? order.items : Array.isArray(order.lineItems) ? order.lineItems : [];
    if (items.length === 0) return '';
    const names = items.map((item) => item?.name || item?.title || item?.sku).filter(Boolean);
    return names.join(', ');
};

const normalizeOrders = (orders = []) => {
    const list = Array.isArray(orders) ? orders : [];
    return list.map((order) => ({
        id: order?.id ?? order?.orderId ?? order?._id ?? `${order?.date ?? order?.createdAt ?? ''}-${order?.total ?? ''}`,
        date: order?.date ?? order?.createdAt ?? order?.orderedAt ?? order?.submittedAt ?? '',
        items: describeOrderItems(order),
        status: order?.status ?? order?.state ?? '',
        total: order?.total ?? order?.amount ?? order?.totalAmount ?? order?.totalPrice ?? 0,
        currency: order?.currency ?? order?.totalCurrency ?? '',
    }));
};

const normalizeCustomer = (customer) => {
    if (!customer) return null;
    const id = customer?.id ?? customer?.customerId ?? customer?._id ?? customer?.userId ?? '';
    const orders = normalizeOrders(customer?.orders ?? customer?.orderHistory ?? customer?.recentOrders);

    return {
        ...customer,
        id,
        name: joinName(customer),
        email: customer?.email ?? customer?.contactEmail ?? '',
        status: normalizeStatus(customer?.status ?? customer?.state),
        type: normalizeCustomerType(customer?.type ?? customer?.customerType),
        lastOrderDate:
            customer?.lastOrderDate ??
            customer?.lastOrderAt ??
            customer?.lastOrder ??
            customer?.lastOrderTime ??
            (orders[0]?.date || ''),
        totalSpent: customer?.totalSpent ?? customer?.lifetimeValue ?? customer?.totalValue ?? customer?.totalSpend ?? 0,
        currency: customer?.currency ?? customer?.totalCurrency ?? customer?.spendCurrency ?? '',
        orders,
    };
};

const normalizeCustomersPayload = (payload) => {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.customers)
            ? payload.customers
            : Array.isArray(payload?.items)
                ? payload.items
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];

    return list.map(normalizeCustomer).filter(Boolean);
};

const extractPagination = (payload, fallbackPage, fallbackSize) => {
    const meta = payload?.meta ?? payload?.pagination ?? payload?.page ?? payload?.paging ?? {};
    const total =
        payload?.total ??
        payload?.totalCount ??
        payload?.totalElements ??
        meta?.total ??
        meta?.totalCount ??
        meta?.totalElements ??
        null;
    const page = payload?.page ?? meta?.page ?? meta?.currentPage ?? fallbackPage;
    const size = payload?.size ?? meta?.size ?? meta?.pageSize ?? fallbackSize;
    const totalPages = payload?.totalPages ?? meta?.totalPages ?? meta?.pageCount ?? null;

    const computedTotalPages = totalPages ?? (total && size ? Math.ceil(total / size) : null);
    return {
        total,
        page: page ?? fallbackPage,
        size: size ?? fallbackSize,
        totalPages: computedTotalPages,
    };
};

const extractKpis = (payload, customers, totalFromMeta) => {
    const summary = payload?.summary ?? payload?.kpis ?? payload?.stats ?? payload?.metrics ?? {};
    const totalCustomers =
        summary?.totalCustomers ??
        summary?.total ??
        summary?.customers ??
        totalFromMeta ??
        customers.length;
    const activeCustomers =
        summary?.activeCustomers ??
        summary?.active ??
        customers.filter((customer) => customer.status === 'Active').length;

    return { totalCustomers, activeCustomers };
};

export async function listAdminCustomers(token, params = {}, { signal } = {}) {
    if (!token) throw new Error('Authentication is required to load customers');
    const resolvedParams = {
        sort: 'last_order_desc',
        page: 1,
        size: 6,
        ...params,
    };
    const searchParams = new URLSearchParams();
    if (resolvedParams.q) searchParams.set('q', resolvedParams.q);
    if (resolvedParams.status && resolvedParams.status !== 'all') searchParams.set('status', resolvedParams.status);
    if (resolvedParams.type && resolvedParams.type !== 'all') searchParams.set('type', resolvedParams.type);
    if (resolvedParams.sort) searchParams.set('sort', resolvedParams.sort);
    if (resolvedParams.page) searchParams.set('page', resolvedParams.page);
    if (resolvedParams.size) searchParams.set('size', resolvedParams.size);

    const url = `${ADMIN_CUSTOMERS_URL}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const res = await authFetch(
        url,
        {
            method: 'GET',
            headers: buildAuthHeaders(token),
            signal,
        },
        { token },
    );
    const payload = await parseApiResponse(res, 'Failed to load customers');
    const customers = normalizeCustomersPayload(payload);
    const sizeFallback = resolvedParams.size ?? (customers.length || 1);
    const pagination = extractPagination(payload, resolvedParams.page ?? 1, sizeFallback);
    const kpis = extractKpis(payload, customers, pagination.total);

    return {
        customers,
        ...pagination,
        ...kpis,
    };
}

export async function fetchAdminCustomer(customerId, token, { signal } = {}) {
    if (!token) throw new Error('Authentication is required to load customer details');
    if (!customerId) throw new Error('Customer ID is required');
    const res = await authFetch(
        `${ADMIN_CUSTOMERS_URL}/${encodeURIComponent(customerId)}`,
        {
            method: 'GET',
            headers: buildAuthHeaders(token),
            signal,
        },
        { token },
    );
    const payload = await parseApiResponse(res, 'Failed to load customer');
    return normalizeCustomer(payload?.customer ?? payload?.data ?? payload);
}
