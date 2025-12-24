export const isFreshItem = (product) => {
    const name = product?.name || '';
    const category = product?.category || '';
    return /basil|herb/i.test(name) || /basil|herb/i.test(category);
};

export const getUnitLabel = (product) => {
    const weight = product?.weight ?? product?.netWeight;
    if (weight !== undefined && weight !== null && weight !== '') {
        return typeof weight === 'number' ? `${weight}g` : String(weight);
    }
    const unitLabel = product?.unitLabel || product?.packSize || product?.size;
    return unitLabel ? String(unitLabel) : null;
};

export const getPriceContext = (product) => {
    const unitLabel = getUnitLabel(product);
    const parts = [];
    parts.push(unitLabel || 'Per item');
    if (isFreshItem(product)) {
        parts.push('Controlled handling');
    }
    return parts.join(' · ');
};

export const getProductFacts = (product) => {
    const unitLabel = getUnitLabel(product);
    const name = product?.name ? product.name.trim() : 'Store item';
    const facts = [`What it is: ${name}${unitLabel ? ` · ${unitLabel}` : ''}`];
    const storageLine = isFreshItem(product)
        ? 'Storage: keep refrigerated at 4–8°C.'
        : 'Storage: keep in a clean, dry place.';
    facts.push(storageLine);
    if (isFreshItem(product)) {
        facts.push('Handling: handled in a controlled environment.');
    }
    return facts;
};
