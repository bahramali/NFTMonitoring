const TIERS = ['DEFAULT', 'SUPPORTER', 'B2B', 'VIP'];

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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
    const tierPricesMap = entity?.tierPrices && typeof entity.tierPrices === 'object' ? entity.tierPrices : {};
    const decimalTierPrice =
        toNumber(tierPricesMap?.[normalizedTier])
        ?? toNumber(tierPricesMap?.[normalizedTier?.toLowerCase?.()]);
    if (decimalTierPrice !== null) return decimalTierPrice;

    const fallbackPrice =
        toNumber(entity?.unitPrice)
        ?? toNumber(entity?.price)
        ?? toNumber(entity?.priceSek);

    const rawPriceByTier = entity?.priceByTier ?? entity?.pricesByTier ?? entity?.prices ?? null;
    const map = rawPriceByTier && typeof rawPriceByTier === 'object' ? rawPriceByTier : {};
    const tierPrice =
        toNumber(map?.[normalizedTier])
        ?? toNumber(map?.[normalizedTier?.toLowerCase?.()]);

    if (tierPrice !== null) return tierPrice;

    if (normalizedTier !== 'DEFAULT') {
        const directTierPrice =
            toNumber(entity?.[`price${normalizedTier}`])
            ?? toNumber(entity?.[`price_${normalizedTier.toLowerCase()}`]);
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
