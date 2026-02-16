import { normalizePricingTier } from './pricingTier.js';

const BUSINESS_TYPE_VALUES = new Set(['B2B', 'COMPANY', 'BUSINESS', 'RESTAURANT']);

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const resolveTotalValue = (totals = {}, keys = []) => {
    for (const key of keys) {
        const value = toNumber(totals?.[key]);
        if (value !== null) return value;
    }
    return null;
};

export const hasBusinessProfile = (profile) => {
    if (!profile || typeof profile !== 'object') return false;

    const raw = profile?.raw ?? {};
    const profileType = `${profile?.customerType ?? profile?.type ?? raw?.customerType ?? raw?.type ?? ''}`.trim().toUpperCase();
    const accountType = `${profile?.accountType ?? raw?.accountType ?? ''}`.trim().toUpperCase();
    const tier = normalizePricingTier(profile?.pricingTier ?? raw?.pricingTier ?? profile?.tier ?? raw?.tier);

    if (BUSINESS_TYPE_VALUES.has(profileType) || BUSINESS_TYPE_VALUES.has(accountType)) {
        return true;
    }

    if (tier === 'B2B') {
        return true;
    }

    return Boolean(
        profile?.businessProfile
        || raw?.businessProfile
        || profile?.companyName
        || raw?.companyName
        || profile?.orgNumber
        || raw?.orgNumber
        || profile?.organizationNumber
        || raw?.organizationNumber,
    );
};

export const resolveTotalsBreakdown = (totals = {}) => {
    const gross = resolveTotalValue(totals, ['total', 'gross', 'totalInclVat', 'grossTotal']);
    const vat = resolveTotalValue(totals, ['tax', 'vat', 'moms', 'vatTotal']) ?? 0;
    const netFromBackend = resolveTotalValue(totals, [
        'net',
        'subtotalExVat',
        'totalExVat',
        'netTotal',
        'subtotalNet',
    ]);

    const fallbackSubtotal = resolveTotalValue(totals, ['subtotal']);
    const resolvedGross = gross ?? fallbackSubtotal ?? 0;
    const net = netFromBackend ?? (resolvedGross - vat);

    return {
        net: Math.max(net, 0),
        vat: Math.max(vat, 0),
        gross: Math.max(resolvedGross, 0),
    };
};
