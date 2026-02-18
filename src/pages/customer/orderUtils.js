import { extractPaymentUrl } from '../../utils/payment.js';

const toStatusKey = (value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

export const CANCELLABLE_ORDER_STATUSES = new Set([
    'PENDING_CONFIRMATION',
    'PENDING_PAYMENT',
    'PENDING',
    'RECEIVED',
    'AWAITING_PAYMENT_CONFIRMATION',
    'PROCESSING',
]);

export const canCancelOrder = (status) => CANCELLABLE_ORDER_STATUSES.has(toStatusKey(status));

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
        tax: pickAmount(
            totals,
            ['tax', 'taxTotal', 'vat', 'vatTotal', 'moms', 'momsTotal'],
            ['taxCents', 'taxTotalCents', 'vatCents', 'vatTotalCents', 'momsCents', 'momsTotalCents'],
        ),
        discount: pickAmount(totals, ['discount', 'discountTotal', 'promoDiscount'], ['discountCents', 'discountTotalCents', 'promoDiscountCents']),
        total: pickAmount(totals, ['total'], ['totalCents', 'totalAmountCents']),
    };
};

export const normalizeOrderList = (payload) => {
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.orders) ? payload.orders : [];
    return list.map((order) => ({
        id: order.orderId ?? order.id ?? order.orderNumber ?? order.reference ?? '',
        orderNumber: order.orderNumber ?? order.reference ?? order.orderId ?? order.id ?? '',
        status: order.displayStatus ?? order.orderStatus ?? order.mappedStatus ?? order.status ?? order.state ?? 'PENDING',
        total: pickAmount(order, ['totalAmount', 'total', 'amount'], ['totalCents', 'totalAmountCents']),
        currency: order.currency ?? order.totalCurrency ?? 'SEK',
        createdAt: order.placedAt ?? order.createdAt ?? order.created ?? order.timestamp,
        updatedAt: order.updatedAt ?? order.updated ?? order.modifiedAt,
        items: (order.items ?? order.lines ?? []).map((item) => normalizeItem(item)),
        itemsCount: Number.isFinite(order.itemsCount) ? order.itemsCount : undefined,
        paymentMethod: order.paymentMethod ?? order.payment?.method ?? order.payment?.brand ?? order.payment_type ?? '',
        paymentReference: order.paymentReference ?? order.payment?.reference ?? order.payment?.id ?? order.paymentIntentId ?? '',
        paymentUrl: extractPaymentUrl(order),
        deliveryType: order.deliveryType,
        paymentMode: order.paymentMode ?? order.payment_mode ?? order.payment?.mode ?? '',
        customerNote: order.customerNote ?? order.note ?? '',
        shippingAddress: order.shippingAddress ?? order.address ?? null,
        totals: normalizeTotals(order),
        raw: order,
    }));
};

export const normalizeOrder = (payload) => {
    const base = payload?.order ?? payload ?? {};
    const normalized = normalizeOrderList([base])[0] || {};
    const payment = base.payment ?? {};
    const paymentMode = toStatusKey(normalized.paymentMode || base.paymentMode || base.payment_mode || payment.mode || '');
    const orderStatus = base.orderStatus ?? payload?.orderStatus ?? payload?.summary?.orderStatus ?? base.summary?.orderStatus ?? null;

    const result = {
        ...normalized,
        orderStatus,
        paymentStatus: base.paymentStatus ?? base.payment_state ?? payment.status ?? '',
        paymentMethod: normalized.paymentMethod || payment.method || payment.brand || base.payment_type || '',
        paymentReference: normalized.paymentReference || payment.reference || payment.id || base.paymentIntentId || '',
        deliveryStatus: base.deliveryStatus ?? base.fulfillmentStatus ?? base.fulfillment?.status ?? '',
        paymentMode,
        invoiceNumber: base.invoiceNumber ?? base.invoice?.number ?? payment.invoiceNumber ?? '',
        invoiceStatus: base.invoiceStatus ?? base.invoice?.status ?? payment.invoiceStatus ?? '',
        invoiceDueDate: base.invoiceDueDate ?? base.invoice?.dueDate ?? payment.invoiceDueDate ?? '',
        bankgiro: base.bankgiro ?? base.invoice?.bankgiro ?? payment.bankgiro ?? '',
        invoiceOcr: base.invoiceOcr ?? base.invoice?.ocr ?? payment.invoiceOcr ?? '',
    };

    if (result.paymentMode === 'INVOICE_PAY_LATER') {
        result.paymentMethod = result.paymentMethod || 'Invoice';
        result.paymentReference = result.paymentReference || result.invoiceNumber || '';
        result.paymentStatus = result.paymentStatus || 'UNPAID';
    }

    return result;
};
