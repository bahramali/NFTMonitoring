const TRAILING_SLASH_REGEX = /\/+$/;

export function getApiBaseUrl() {
    const baseUrl = import.meta.env?.VITE_API_BASE_URL ?? import.meta.env?.VITE_API_BASE ?? "";

    if (!baseUrl) {
        return "";
    }

    return baseUrl.replace(TRAILING_SLASH_REGEX, "");
}
