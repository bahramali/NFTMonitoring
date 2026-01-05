const normalizeVariantList = (variants) => {
    if (!variants) return [];
    if (Array.isArray(variants)) return variants;
    if (Array.isArray(variants.items)) return variants.items;
    if (Array.isArray(variants.nodes)) return variants.nodes;
    if (Array.isArray(variants.data)) return variants.data;
    if (typeof variants === 'object') return Object.values(variants);
    return [];
};

export const getVariantStock = (variant) => {
    if (!variant) return undefined;
    const stockValue =
        variant.stock
        ?? variant.availableStock
        ?? variant.inventory
        ?? variant.inventoryQuantity
        ?? variant.qtyAvailable;
    return stockValue === null ? undefined : stockValue;
};

export const getVariantPrice = (variant) => {
    if (!variant) return undefined;
    const priceValue = variant.price ?? variant.unitPrice;
    if (priceValue != null) return priceValue;
    if (variant.priceCents != null) return variant.priceCents / 100;
    if (variant.unitPriceCents != null) return variant.unitPriceCents / 100;
    return undefined;
};

export const getVariantLabel = (variant) => {
    if (!variant) return '';
    const label =
        variant.label
        ?? variant.name
        ?? variant.title
        ?? variant.weight
        ?? variant.weightLabel
        ?? variant.size
        ?? variant.option;
    return label === null || label === undefined ? '' : String(label);
};

export const getActiveVariants = (product) => {
    const variantsSource =
        product?.variants
        ?? product?.variantOptions
        ?? product?.options
        ?? product?.weights
        ?? product?.sizes;
    const variants = normalizeVariantList(variantsSource);
    return variants.filter((variant) => variant && variant.active !== false && variant.isActive !== false);
};

export const getDefaultVariantId = (variants = []) => {
    const list = Array.isArray(variants) ? variants : [];
    const inStockVariant = list.find((variant) => {
        const stockValue = getVariantStock(variant);
        return stockValue !== undefined && stockValue > 0;
    });
    const fallback = inStockVariant ?? list[0];
    return fallback?.id ?? null;
};

export const isVariantInStock = (variant) => {
    const stockValue = getVariantStock(variant);
    return stockValue === undefined || stockValue > 0;
};

export const isProductInStock = (product) => {
    const variants = getActiveVariants(product);
    if (variants.length > 0) {
        return variants.some((variant) => isVariantInStock(variant));
    }
    const stockValue = product?.stock;
    return stockValue === undefined || stockValue > 0;
};

export const getProductSortPrice = (product) => {
    const variants = getActiveVariants(product);
    if (variants.length > 0) {
        const prices = variants.map(getVariantPrice).filter((value) => Number.isFinite(value));
        if (prices.length > 0) {
            return Math.min(...prices);
        }
    }
    return product?.price ?? 0;
};

export const getProductVariantId = (product) => product?.defaultVariantId ?? product?.variantId ?? product?.id ?? null;

export const getCartItemDisplayName = (item) => {
    const name = item?.name ?? '';
    const variantLabel =
        item?.variant?.label
        ?? item?.variant?.name
        ?? item?.variantLabel
        ?? item?.variantName
        ?? item?.option
        ?? item?.size;
    if (!variantLabel) return name;
    return `${name} — ${variantLabel}`.trim();
};
