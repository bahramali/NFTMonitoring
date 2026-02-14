export const STOREFRONT_CART_STORAGE_KEY = 'storefrontCartSession';
export const STOREFRONT_CART_RESET_EVENT = 'storefront:reset-cart-session';

const STOREFRONT_SESSION_COOKIE_NAMES = [
    'storefrontCartSession',
    'cartId',
    'sessionId',
    'storefrontCartId',
    'storefrontSessionId',
];

const clearCookie = (name) => {
    if (typeof document === 'undefined' || !name) return;
    const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = `${name}=; expires=${expires}; path=/; SameSite=Lax`;
};

export const clearPersistedStorefrontSession = () => {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STOREFRONT_CART_STORAGE_KEY);
    }

    STOREFRONT_SESSION_COOKIE_NAMES.forEach(clearCookie);
};

export const notifyStorefrontSessionReset = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(STOREFRONT_CART_RESET_EVENT));
};

