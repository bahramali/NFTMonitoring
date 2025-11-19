const RELATIVE_BASE_VALUES = new Set(['.', './', '/./']);

const trimTrailingSlashes = (value) => {
    if (!value) return '/';
    const trimmed = value.replace(/\/+$/, '');
    return trimmed || '/';
};

export function resolveBasePath(options = {}) {
    const rawBase = options.rawBase ?? import.meta?.env?.BASE_URL ?? '/';

    if (!RELATIVE_BASE_VALUES.has(rawBase)) {
        return trimTrailingSlashes(rawBase);
    }

    const location = options.location ?? (typeof window !== 'undefined' ? window.location : undefined);
    if (!location) {
        return '/';
    }

    const hostname = String(location.hostname || '').toLowerCase();
    if (hostname.endsWith('.github.io')) {
        const segments = String(location.pathname || '')
            .split('/')
            .filter(Boolean);
        if (segments.length > 0) {
            return `/${segments[0]}`;
        }
    }

    return '/';
}
