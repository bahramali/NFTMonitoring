const STRIPE_JS_URL = 'https://js.stripe.com/v3/';

let stripePromise;

const loadStripeScript = () => new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
        reject(new Error('Stripe.js can only be loaded in the browser.'));
        return;
    }

    const existingScript = document.querySelector(`script[src="${STRIPE_JS_URL}"]`);
    if (existingScript) {
        if (window.Stripe) {
            resolve();
            return;
        }
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Stripe.js.')));
        return;
    }

    const script = document.createElement('script');
    script.src = STRIPE_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe.js.'));
    document.body.appendChild(script);
});

export const getStripePromise = () => {
    const publishableKey = import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey || typeof window === 'undefined') return null;
    if (!stripePromise) {
        stripePromise = loadStripeScript().then(() => {
            if (!window.Stripe) {
                throw new Error('Stripe.js failed to initialize.');
            }
            return window.Stripe(publishableKey);
        });
    }
    return stripePromise;
};
