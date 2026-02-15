import { authFetch, parseApiResponse } from './http.js';
import { getApiBaseUrl } from '../config/apiBase.js';

const API_BASE = getApiBaseUrl();
const ADMIN_BANNERS_URL = `${API_BASE}/api/admin/store/banners`;

const authHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const normalizeBanner = (banner = {}) => ({
    ...banner,
    id: banner?.id ?? banner?.bannerId ?? banner?._id ?? '',
    title: banner?.title ?? '',
    type: banner?.type ?? 'PROMO',
    active: banner?.active !== false,
    position: Number.isFinite(Number(banner?.position)) ? Number(banner.position) : 0,
});

const normalizeBannerList = (payload) => {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.banners)
            ? payload.banners
            : [];

    return list.map(normalizeBanner);
};

export async function listAdminBanners(token, { signal } = {}) {
    const res = await authFetch(
        ADMIN_BANNERS_URL,
        {
            method: 'GET',
            headers: authHeaders(token),
            signal,
        },
        { token },
    );

    const payload = await parseApiResponse(res, 'Failed to load banners');
    return normalizeBannerList(payload);
}

export async function createAdminBanner(token, banner) {
    const res = await authFetch(
        ADMIN_BANNERS_URL,
        {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify(banner),
        },
        { token },
    );

    const payload = await parseApiResponse(res, 'Failed to create banner');
    return normalizeBanner(payload);
}

export async function updateAdminBanner(token, bannerId, banner) {
    if (!bannerId) throw new Error('Banner ID is required');

    const res = await authFetch(
        `${ADMIN_BANNERS_URL}/${encodeURIComponent(bannerId)}`,
        {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify(banner),
        },
        { token },
    );

    const payload = await parseApiResponse(res, 'Failed to update banner');
    return normalizeBanner(payload);
}

export async function deleteAdminBanner(token, bannerId) {
    if (!bannerId) throw new Error('Banner ID is required');

    const res = await authFetch(
        `${ADMIN_BANNERS_URL}/${encodeURIComponent(bannerId)}`,
        {
            method: 'DELETE',
            headers: authHeaders(token),
        },
        { token },
    );

    return parseApiResponse(res, 'Failed to delete banner');
}
