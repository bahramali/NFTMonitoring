export const normalizeOrderList = (payload) => {
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.orders) ? payload.orders : [];
    return list.map((order) => ({
        id: order.id ?? order.orderId ?? order.reference ?? '',
        status: order.status ?? order.state ?? 'PENDING',
        total: order.total ?? order.totalAmount ?? order.amount ?? null,
        currency: order.currency ?? 'SEK',
        createdAt: order.createdAt ?? order.created ?? order.timestamp ?? order.placedAt,
        updatedAt: order.updatedAt ?? order.updated ?? order.modifiedAt,
        items: order.items ?? order.lines ?? [],
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
