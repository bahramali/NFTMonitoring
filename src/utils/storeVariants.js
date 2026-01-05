export const getVariantStock = (variant) => {
    if (!variant) return undefined;
    const stockValue = variant.stock ?? variant.availableStock ?? variant.inventory;
    return stockValue === null ? undefined : stockValue;
};

export const getVariantLabel = (variant) => {
    if (!variant) return '';
    const label = variant.label ?? variant.name ?? variant.title ?? variant.weight ?? variant.size ?? variant.option;
    return label === null || label === undefined ? '' : String(label);
};

export const getActiveVariants = (product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
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
        const prices = variants
            .map((variant) => variant?.price ?? variant?.unitPrice)
            .filter((value) => Number.isFinite(value));
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
