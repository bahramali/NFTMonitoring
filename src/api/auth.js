import { authFetch, buildAuthHeaders, parseApiResponse } from './http.js';

const API_BASE = import.meta.env?.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const AUTH_BASE = `${API_BASE}/api/auth`;
const PROFILE_URL = `${API_BASE}/api/me`;

export async function fetchInviteDetails(token) {
    if (!token) {
        throw new Error('Invite token is required.');
    }

    const res = await fetch(`${AUTH_BASE}/accept-invite/${encodeURIComponent(token)}`);
    return parseApiResponse(res, 'Failed to validate invite');
}

export async function completeInvite(token, password) {
    if (!token) {
        throw new Error('Invite token is required.');
    }

    const res = await fetch(`${AUTH_BASE}/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
    });

    return parseApiResponse(res, 'Failed to accept invite');
}

export async function fetchSessionProfile(token, { signal } = {}) {
    if (!token) {
        throw new Error('Authentication is required to load the profile.');
    }

    const res = await authFetch(
        PROFILE_URL,
        {
            headers: buildAuthHeaders(token),
            signal,
        },
        { token },
    );

    return parseApiResponse(res, 'Failed to load profile');
}

export async function fetchSessionProfileWithCredentials({ signal } = {}) {
    const res = await fetch(PROFILE_URL, {
        credentials: 'include',
        signal,
    });

    return parseApiResponse(res, 'Failed to load profile');
}

export async function refreshAccessToken({ signal } = {}) {
    const res = await fetch(`${AUTH_BASE}/refresh`, {
        method: 'POST',
        credentials: 'include',
        signal,
    });

    return parseApiResponse(res, 'Failed to refresh session');
}

export async function logoutSession({ signal } = {}) {
    const res = await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
        signal,
    });

    return parseApiResponse(res, 'Failed to log out');
}

export async function confirmPasswordReset(token, password) {
    if (!token) {
        throw new Error('Reset token is required.');
    }

    const res = await fetch(`${AUTH_BASE}/password-reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
    });

    return parseApiResponse(res, 'Failed to reset password');
}

export async function startOAuthSignIn(provider, { returnUrl, redirectUri } = {}) {
    if (!provider) {
        throw new Error('OAuth provider is required.');
    }

    const payload = {};
    if (returnUrl) payload.returnUrl = returnUrl;
    if (redirectUri) payload.redirectUri = redirectUri;

    const res = await fetch(`${AUTH_BASE}/oauth/${encodeURIComponent(provider)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });

    return parseApiResponse(res, 'Failed to start OAuth sign-in');
}

export async function startGoogleSignIn({ redirectUri } = {}) {
    if (!redirectUri) {
        throw new Error('Redirect URI is required.');
    }

    const res = await fetch(`${AUTH_BASE}/oauth/google/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUri }),
    });

    return parseApiResponse(res, 'Failed to start Google sign-in');
}

export async function fetchOAuthProviders({ signal } = {}) {
    const res = await fetch(`${AUTH_BASE}/oauth/providers`, {
        credentials: 'include',
        signal,
    });

    return parseApiResponse(res, 'Failed to load OAuth providers');
}

export async function completeOAuthCallback(provider, { code, state, signal } = {}) {
    if (!provider) {
        throw new Error('OAuth provider is required.');
    }
    if (!code || !state) {
        throw new Error('OAuth callback code and state are required.');
    }

    const callbackUrl = new URL(`${AUTH_BASE}/oauth/${encodeURIComponent(provider)}/callback`);
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('state', state);

    const res = await fetch(callbackUrl.toString(), {
        credentials: 'include',
        signal,
    });

    return parseApiResponse(res, 'Failed to complete OAuth sign-in');
}
