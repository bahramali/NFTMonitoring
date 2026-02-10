export function normalizeProfile(payload) {
    const source = payload?.user ?? payload ?? {};
    const raw = source.raw ?? source;
    const email = source.email ?? source.username ?? '';
    const username = source.username ?? raw.username ?? raw.userName ?? '';
    const fullName = raw.fullName ?? source.fullName ?? source.displayName ?? '';
    const phoneNumber = raw.phoneNumber ?? source.phoneNumber ?? raw.phone ?? source.phone ?? '';
    const displayName =
        fullName || source.displayName || source.name || source.fullName || source.nickname || email || 'Customer';
    const pictureUrl =
        source.pictureUrl
        || source.picture_url
        || raw.pictureUrl
        || raw.picture_url
        || source.avatarUrl
        || raw.avatarUrl
        || null;

    return {
        id: source.id ?? source.userId ?? null,
        email,
        username,
        fullName,
        phoneNumber,
        displayName,
        pictureUrl,
        role: source.role ?? 'CUSTOMER',
        raw,
        features: source.features ?? source.capabilities ?? [],
    };
}

export default normalizeProfile;
