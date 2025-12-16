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

// Legacy helpers retained for the existing ControlPanel page
export async function fetchShellyDevices() {
    const hierarchy = await fetchHierarchy();
    if (!hierarchy?.rooms) return [];

    return hierarchy.rooms.flatMap((room) =>
        (room.racks || []).flatMap((rack) =>
            (rack.sockets || []).map((socket) => ({
                id: socket.socketId,
                name: socket.name || socket.socketId,
                status: socket.status ?? socket.state ?? null,
                roomId: room.id,
                rackId: rack.id,
            }))
        )
    );
}

export async function fetchShellyDeviceStatus(socketId) {
    const statuses = await fetchStatuses([socketId]);
    if (Array.isArray(statuses)) {
        return statuses.find((entry) => entry.socketId === socketId || entry.id === socketId) ?? statuses[0];
    }
    return statuses;
}

export async function toggleShellyDevice(socketId) {
    return toggleSocket(socketId);
}

export async function turnShellyOn(socketId) {
    return setSocketState(socketId, true);
}

export async function turnShellyOff(socketId) {
    return setSocketState(socketId, false);
}

export async function scheduleShellyDevice(socketId, payload = {}) {
    const body = { socketId };

    if (payload.durationMinutes) {
        body.type = "AUTO_OFF";
        body.durationMinutes = payload.durationMinutes;
    } else if (payload.turnOnAt || payload.turnOffAt) {
        body.type = "TIME_RANGE";
        if (payload.turnOnAt) body.startTime = payload.turnOnAt;
        if (payload.turnOffAt) body.endTime = payload.turnOffAt;
    }

    return createAutomation(body);
}
