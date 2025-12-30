export const normalizeAddress = (address = {}) => {
    const source = address ?? {};
    return {
        id: source.id ?? source.addressId ?? source._id ?? source.uuid ?? null,
        label: source.label ?? source.name ?? source.nickname ?? '',
        fullName: source.fullName ?? source.recipientName ?? source.contactName ?? source.name ?? '',
        line1: source.line1 ?? source.address1 ?? source.street1 ?? source.street ?? '',
        line2: source.line2 ?? source.address2 ?? source.street2 ?? '',
        city: source.city ?? source.town ?? source.locality ?? '',
        state: source.state ?? source.region ?? source.province ?? '',
        postalCode: source.postalCode ?? source.zip ?? source.zipCode ?? '',
        country: source.country ?? source.countryCode ?? '',
        phone: source.phone ?? source.phoneNumber ?? '',
        isDefault: source.isDefault ?? source.default ?? source.primary ?? false,
        raw: source,
    };
};

export const formatAddressLine = (address = {}) => {
    const parts = [
        address.line1,
        address.line2,
        [address.postalCode, address.city].filter(Boolean).join(' '),
        address.state,
        address.country,
    ]
        .map((part) => (typeof part === 'string' ? part.trim() : part))
        .filter(Boolean);

    return parts.join(', ');
};

export const extractAddressList = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.addresses)) return payload.addresses;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
};
