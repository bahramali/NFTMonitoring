import { extractPaymentUrl } from '../../utils/payment.js';

const toNumber = (value) => {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const centsToMajor = (value) => {
    const parsed = toNumber(value);
    return parsed == null ? null : parsed / 100;
};

const pickAmount = (source, majorKeys = [], centsKeys = []) => {
    for (const key of majorKeys) {
        const value = toNumber(source?.[key]);
        if (value != null) return value;
    }
    for (const key of centsKeys) {
        const value = centsToMajor(source?.[key]);
        if (value != null) return value;
    }
    return null;
};

const normalizeItem = (item = {}) => {
    const quantity = toNumber(item.quantity ?? item.qty ?? item.count) ?? 1;
    const unitPrice = pickAmount(item, ['price', 'unitPrice', 'amount'], ['unitPriceCents', 'priceCents']);
    const lineTotal = pickAmount(item, ['lineTotal', 'total', 'totalPrice'], ['lineTotalCents', 'totalCents']);

    return {
        ...item,
        quantity,
        name: item.name ?? item.productName ?? item.title ?? item.productTitle ?? 'Item',
        price: unitPrice ?? 0,
        lineTotal: lineTotal ?? (unitPrice != null ? unitPrice * quantity : 0),
    };
};

const normalizeTotals = (order = {}) => {
    const totals = order.totals ?? order.summary ?? order.amounts ?? {};
    return {
        currency: totals.currency ?? order.currency ?? order.totalCurrency ?? 'SEK',
        subtotal: pickAmount(
            totals,
            ['subtotal', 'subTotal', 'itemsSubtotal', 'itemsTotal'],
            ['subtotalCents', 'subTotalCents', 'itemsSubtotalCents', 'itemsTotalCents'],
        ),
        shipping: pickAmount(totals, ['shipping', 'shippingTotal', 'deliveryFee'], ['shippingCents', 'shippingTotalCents', 'deliveryFeeCents']),
        tax: pickAmount(totals, ['tax', 'taxTotal'], ['taxCents', 'taxTotalCents']),
        discount: pickAmount(totals, ['discount', 'discountTotal', 'promoDiscount'], ['discountCents', 'discountTotalCents', 'promoDiscountCents']),
        total: pickAmount(totals, ['total'], ['totalCents', 'totalAmountCents']),
    };
};

export const normalizeOrderList = (payload) => {
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.orders) ? payload.orders : [];
    return list.map((order) => ({
        id: order.orderId ?? order.id ?? order.orderNumber ?? order.reference ?? '',
        status: order.displayStatus ?? order.orderStatus ?? order.mappedStatus ?? order.status ?? order.state ?? 'PENDING',
        total: pickAmount(order, ['totalAmount', 'total', 'amount'], ['totalCents', 'totalAmountCents']),
        currency: order.currency ?? order.totalCurrency ?? 'SEK',
        createdAt: order.placedAt ?? order.createdAt ?? order.created ?? order.timestamp,
        updatedAt: order.updatedAt ?? order.updated ?? order.modifiedAt,
        items: (order.items ?? order.lines ?? []).map((item) => normalizeItem(item)),
        itemsCount: Number.isFinite(order.itemsCount) ? order.itemsCount : undefined,
        paymentMethod: order.paymentMethod,
        paymentUrl: extractPaymentUrl(order),
        deliveryType: order.deliveryType,
        customerNote: order.customerNote ?? order.note ?? '',
        shippingAddress: order.shippingAddress ?? order.address ?? null,
        totals: normalizeTotals(order),
        raw: order,
    }));
};

export const normalizeOrder = (payload) => {
    const base = payload?.order ?? payload ?? {};
    const normalized = normalizeOrderList([base])[0] || {};

    return {
        ...normalized,
        paymentStatus: base.paymentStatus ?? base.payment_state ?? base.payment?.status ?? '',
        deliveryStatus: base.deliveryStatus ?? base.fulfillmentStatus ?? base.fulfillment?.status ?? '',
    };
};
