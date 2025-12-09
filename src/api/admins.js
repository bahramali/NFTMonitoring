const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const BASE_URL = `${API_BASE}/api/admins`;

const DEFAULT_INVITE_SENDER_EMAIL = 'bahramali.az@gmail.com';

export function getInviteSenderEmail() {
    return import.meta.env.VITE_INVITE_SENDER_EMAIL?.trim() || DEFAULT_INVITE_SENDER_EMAIL;
}

export async function sendAdminInvite(admin) {
    const senderEmail = getInviteSenderEmail();
    const res = await fetch(`${BASE_URL}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...admin, fromEmail: senderEmail }),
    });

    if (!res.ok) throw new Error('Failed to send admin invite email');
    return res.json().catch(() => undefined);
}
