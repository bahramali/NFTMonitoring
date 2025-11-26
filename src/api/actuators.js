const API_BASE = import.meta.env?.VITE_API_BASE ?? "https://api.hydroleaf.se";
const BASE_URL = `${API_BASE}/api/actuators`;

export async function sendLedCommand(payload) {
    const res = await fetch(`${BASE_URL}/led/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        let message = `Failed to send LED command (${res.status})`;
        try {
            const body = await res.json();
            if (body?.message) message = body.message;
        } catch {
            // ignore JSON parsing errors
        }
        throw new Error(message);
    }

    try {
        return await res.json();
    } catch {
        return { accepted: true };
    }
}

export async function sendLedSchedule(payload) {
    const res = await fetch(`${BASE_URL}/led/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        let message = `Failed to send LED command (${res.status})`;
        try {
            const body = await res.json();
            if (body?.message) message = body.message;
        } catch {
            // ignore JSON parsing errors
        }
        throw new Error(message);
    }

    try {
        return await res.json();
    } catch {
        return { accepted: true };
    }
}
