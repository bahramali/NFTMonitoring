const TIERS = ['DEFAULT', 'SUPPORTER', 'B2B', 'VIP'];

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const fromCents = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed / 100 : null;
};


const resolveEffectivePrice = (entity) => {
    if (!entity || typeof entity !== 'object') return null;
    return (
        toNumber(entity?.effectivePriceSek)
        ?? toNumber(entity?.effectivePrice)
        ?? fromCents(entity?.effectivePriceCents)
        ?? fromCents(entity?.effectiveUnitPrice)
    );
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
    const tierPricesSekMap = entity?.tierPricesSek && typeof entity.tierPricesSek === 'object' ? entity.tierPricesSek : {};
    const sekTierPrice =
        toNumber(tierPricesSekMap?.[normalizedTier])
        ?? toNumber(tierPricesSekMap?.[normalizedTier?.toLowerCase?.()]);
    if (sekTierPrice !== null) return sekTierPrice;

    const tierPricesMap = entity?.tierPrices && typeof entity.tierPrices === 'object' ? entity.tierPrices : {};
    const decimalTierPriceFromCents =
        fromCents(tierPricesMap?.[normalizedTier])
        ?? fromCents(tierPricesMap?.[normalizedTier?.toLowerCase?.()]);
    if (decimalTierPriceFromCents !== null) return decimalTierPriceFromCents;

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

export const resolvePricingForTier = (entity, tier = 'DEFAULT') => {
    const appliedTier = normalizePricingTier(tier);
    const regularPriceSek = resolveTierPrice(entity, 'DEFAULT');
    const tierMappedPriceSek = resolveTierPrice(entity, appliedTier);
    const effectivePriceSek = appliedTier !== 'DEFAULT' ? resolveEffectivePrice(entity) : null;

    return {
        regularPriceSek,
        customerPriceSek: effectivePriceSek ?? tierMappedPriceSek,
        appliedTier,
    };
};

export const PRICING_TIERS = TIERS;
