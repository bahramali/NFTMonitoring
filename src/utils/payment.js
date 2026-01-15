export const extractPaymentUrl = (source) => {
    if (!source) return null;
    if (typeof source === 'string') return source;

    return (
        source.paymentUrl
        ?? source.payment_url
        ?? source.checkoutUrl
        ?? source.checkout_url
        ?? source.redirectUrl
        ?? source.redirect_url
        ?? source.url
        ?? source.payment?.url
        ?? source.payment?.paymentUrl
        ?? source.checkout?.paymentUrl
        ?? source.checkout?.url
        ?? source.checkout?.checkoutUrl
        ?? null
    );
};

export const resolveOrderPaymentUrl = (order) =>
    extractPaymentUrl(order)
    ?? extractPaymentUrl(order?.raw)
    ?? extractPaymentUrl(order?.raw?.payment)
    ?? null;
