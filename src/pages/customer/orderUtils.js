export const normalizeOrderList = (payload) => {
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.orders) ? payload.orders : [];
    return list.map((order) => ({
        id: order.orderId ?? order.id ?? order.orderNumber ?? order.reference ?? '',
        status: order.mappedStatus ?? order.status ?? order.state ?? 'PENDING',
        total: order.totalAmount ?? order.total ?? order.amount ?? null,
        currency: order.currency ?? order.totalCurrency ?? 'SEK',
        createdAt: order.placedAt ?? order.createdAt ?? order.created ?? order.timestamp,
        updatedAt: order.updatedAt ?? order.updated ?? order.modifiedAt,
        items: order.items ?? order.lines ?? [],
        itemsCount: Number.isFinite(order.itemsCount) ? order.itemsCount : undefined,
        paymentMethod: order.paymentMethod,
        deliveryType: order.deliveryType,
        customerNote: order.customerNote ?? order.note ?? '',
        shippingAddress: order.shippingAddress ?? order.address ?? null,
        raw: order,
    }));
};

export const normalizeOrder = (payload) => {
    const base = payload?.order ?? payload ?? {};
    const normalized = normalizeOrderList([base])[0] || {};

    return {
        ...normalized,
        paymentStatus: base.paymentStatus ?? base.payment_state ?? '',
        deliveryStatus: base.deliveryStatus ?? base.fulfillmentStatus ?? '',
    };
};
