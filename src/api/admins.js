const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const BASE_URL = `${API_BASE}/api/admins`;

const DEFAULT_INVITE_SENDER_EMAIL = 'bahramali.az@gmail.com';

export function getInviteSenderEmail() {
    return import.meta.env.VITE_INVITE_SENDER_EMAIL?.trim() || DEFAULT_INVITE_SENDER_EMAIL;
}

export async function sendAdminInvite(admin) {
    const senderEmail = getInviteSenderEmail();

    try {
        const res = await fetch(`${BASE_URL}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...admin, fromEmail: senderEmail }),
        });

        if (!res.ok) {
            let message = `Failed to send admin invite email (${res.status})`;
            try {
                const body = await res.json();
                if (body?.message) message = body.message;
            } catch {
                // ignore JSON parse errors and keep the default message
            }
            throw new Error(message);
        }

        await res.json().catch(() => undefined);
        return { queued: true, senderEmail };
    } catch (error) {
        console.warn('Unable to queue admin invite, falling back to manual flow', error);
        return { queued: false, senderEmail, errorMessage: error?.message };
    }
}
