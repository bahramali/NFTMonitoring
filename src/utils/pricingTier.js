const TIERS = ['DEFAULT', 'SUPPORTER', 'B2B', 'VIP'];

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const fromCents = (cents) => {
    const parsed = toNumber(cents);
    return parsed === null ? null : parsed / 100;
};

export const normalizePricingTier = (value) => {
    const normalized = `${value ?? ''}`.trim().toUpperCase();
    if (!normalized) return 'DEFAULT';
    return TIERS.includes(normalized) ? normalized : 'DEFAULT';
};

export const extractUserPricingTier = (profile) => {
    const tier =
        profile?.pricingTier
        ?? profile?.tier
        ?? profile?.raw?.pricingTier
        ?? profile?.raw?.tier
        ?? profile?.raw?.customer?.pricingTier
        ?? profile?.raw?.customerTier;
    return normalizePricingTier(tier);
};

export const resolveTierPrice = (entity, tier = 'DEFAULT') => {
    if (!entity) return null;
    const normalizedTier = normalizePricingTier(tier);
    const fallbackPrice =
        toNumber(entity?.unitPrice)
        ?? toNumber(entity?.price)
        ?? toNumber(entity?.priceSek)
        ?? fromCents(entity?.unitPriceCents)
        ?? fromCents(entity?.priceCents)
        ?? fromCents(entity?.price_sek_cents);

    const rawPriceByTier = entity?.priceByTier ?? entity?.pricesByTier ?? entity?.tierPrices ?? entity?.prices ?? null;
    const map = rawPriceByTier && typeof rawPriceByTier === 'object' ? rawPriceByTier : {};
    const tierPrice =
        toNumber(map?.[normalizedTier])
        ?? toNumber(map?.[normalizedTier?.toLowerCase?.()])
        ?? fromCents(map?.[`${normalizedTier}_CENTS`])
        ?? fromCents(map?.[`${normalizedTier?.toLowerCase?.()}_cents`]);

    if (tierPrice !== null) return tierPrice;

    if (normalizedTier !== 'DEFAULT') {
        const directTierPrice =
            toNumber(entity?.[`price${normalizedTier}`])
            ?? toNumber(entity?.[`price_${normalizedTier.toLowerCase()}`])
            ?? fromCents(entity?.[`price${normalizedTier}Cents`])
            ?? fromCents(entity?.[`price_${normalizedTier.toLowerCase()}_cents`]);
        if (directTierPrice !== null) return directTierPrice;
    }

    return fallbackPrice;
};

export const hasTierPriceDiscount = (entity, tier = 'DEFAULT') => {
    const current = resolveTierPrice(entity, tier);
    const base = resolveTierPrice(entity, 'DEFAULT');
    return current !== null && base !== null && current < base;
};

export const PRICING_TIERS = TIERS;
