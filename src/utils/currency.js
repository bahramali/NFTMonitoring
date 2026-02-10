export function formatCurrency(amount, currency = 'SEK') {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '';
    try {
        return new Intl.NumberFormat('sv-SE', {
            style: 'currency',
            currency: currency || 'SEK',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(amount));
    } catch {
        return `${Number(amount).toFixed(2)} ${currency || 'SEK'}`;
    }
}

export function currencyLabel(currency = 'SEK') {
    if (!currency) return 'SEK';
    return currency.toUpperCase();
}
