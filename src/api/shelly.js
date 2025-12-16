import { API_BASE } from "./topics";

const SHELLY_BASE = `${API_BASE}/api/shelly`;

async function handleResponse(response, defaultErrorMessage) {
    if (!response.ok) {
        let message = `${defaultErrorMessage} (${response.status})`;
        try {
            const body = await response.json();
            if (body?.message) message = body.message;
        } catch {
            // ignore
        }
        throw new Error(message);
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
}

export async function fetchHierarchy({ signal } = {}) {
    const response = await fetch(`${SHELLY_BASE}/rooms`, { signal });
    return handleResponse(response, "Failed to load rooms");
}

export async function fetchStatuses(ids = []) {
    const params = ids.length ? `?ids=${ids.join(",")}` : "";
    const response = await fetch(`${SHELLY_BASE}/status${params}`);
    return handleResponse(response, "Failed to load statuses");
}

export async function toggleSocket(socketId) {
    const response = await fetch(`${SHELLY_BASE}/socket/${socketId}/toggle`, { method: "POST" });
    return handleResponse(response, "Failed to toggle socket");
}

export async function setSocketState(socketId, on) {
    const response = await fetch(`${SHELLY_BASE}/socket/${socketId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on }),
    });
    return handleResponse(response, `Failed to update ${socketId}`);
}

export async function fetchAutomations() {
    const response = await fetch(`${SHELLY_BASE}/automation`);
    return handleResponse(response, "Failed to load automations");
}

export async function createAutomation(payload) {
    const response = await fetch(`${SHELLY_BASE}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
    });
    return handleResponse(response, "Failed to create automation");
}

export async function deleteAutomation(id) {
    const response = await fetch(`${SHELLY_BASE}/automation/${id}`, { method: "DELETE" });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete automation");
    }
    return true;
}

export { SHELLY_BASE };
