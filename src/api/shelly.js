import { API_BASE } from "./topics";
import { authFetch } from "./http.js";

const SHELLY_BASE = `${API_BASE}/api/shelly`;

const AUTH_HEADERS = { Accept: "application/json" };

const withAuth = (options = {}) => ({
    ...options,
    headers: { ...AUTH_HEADERS, ...(options.headers ?? {}) },
});

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

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    try {
        if (isJson) return await response.json();
        const fallbackText = await response.text();
        if (fallbackText) throw new Error(fallbackText);
        return null;
    } catch (error) {
        throw error instanceof Error ? error : new Error("Unexpected response from Shelly API");
    }
}

export async function fetchHierarchy({ signal } = {}) {
    const roomsResponse = await authFetch(`${SHELLY_BASE}/rooms`, withAuth({ signal }));
    const roomsPayload = await handleResponse(roomsResponse, "Failed to load rooms");
    const rooms = Array.isArray(roomsPayload) ? roomsPayload : roomsPayload?.rooms;

    if (!Array.isArray(rooms)) return { rooms: [] };

    const roomWithRacks = await Promise.all(
        rooms.map(async (room) => {
            const racksResponse = await authFetch(`${SHELLY_BASE}/rooms/${room.id}/racks`, withAuth({ signal }));
            const racks = await handleResponse(racksResponse, `Failed to load racks for room ${room.id}`);

            const racksWithSockets = await Promise.all(
                (racks || []).map(async (rack) => {
                    const socketsResponse = await authFetch(
                        `${SHELLY_BASE}/racks/${rack.id}/sockets`,
                        withAuth({ signal }),
                    );
                    const sockets = await handleResponse(socketsResponse, `Failed to load sockets for rack ${rack.id}`);
                    return { ...rack, sockets: sockets || [] };
                })
            );

            return { ...room, racks: racksWithSockets };
        })
    );

    return { rooms: roomWithRacks };
}

export async function fetchStatuses() {
    const response = await authFetch(`${SHELLY_BASE}/status`, withAuth());
    const payload = await handleResponse(response, "Failed to load statuses");
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.statuses)) return payload.statuses;
    return [];
}

export async function fetchSocketStatus(socketId) {
    const response = await authFetch(`${SHELLY_BASE}/sockets/${socketId}/status`, withAuth());
    return handleResponse(response, `Failed to load status for ${socketId}`);
}

export async function toggleSocket(socketId) {
    const response = await authFetch(`${SHELLY_BASE}/sockets/${socketId}/toggle`, withAuth({
        method: "POST",
    }));
    return handleResponse(response, "Failed to toggle socket");
}

export async function setSocketState(socketId, on) {
    const endpoint = on ? "on" : "off";
    const response = await authFetch(`${SHELLY_BASE}/sockets/${socketId}/${endpoint}`, withAuth({
        method: "POST",
    }));
    return handleResponse(response, `Failed to update ${socketId}`);
}

export async function fetchAutomations() {
    const response = await authFetch(`${SHELLY_BASE}/automation`, withAuth());
    return handleResponse(response, "Failed to load automations");
}

export async function createAutomation(payload) {
    const response = await authFetch(`${SHELLY_BASE}/automation`, withAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
    }));
    return handleResponse(response, "Failed to create automation");
}

export async function deleteAutomation(id) {
    const response = await authFetch(`${SHELLY_BASE}/automation/${id}`, withAuth({
        method: "DELETE",
    }));
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
                id: socket.socketId || socket.id,
                name: socket.name || socket.socketId || socket.id,
                status: socket.status ?? socket.state ?? null,
                roomId: room.id,
                rackId: rack.id,
            }))
        )
    );
}

export async function fetchShellyDeviceStatus(socketId) {
    return fetchSocketStatus(socketId);
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
        if (payload.startNow !== undefined) body.startNow = payload.startNow;
    } else if (payload.intervalMinutes) {
        body.type = "INTERVAL_TOGGLE";
        body.intervalMinutes = payload.intervalMinutes;
        body.mode = payload.mode || "TOGGLE";
        if (payload.pulseSeconds) body.pulseSeconds = payload.pulseSeconds;
    } else if (payload.turnOnAt || payload.turnOffAt) {
        body.type = "TIME_RANGE";
        if (payload.turnOnAt) body.onTime = payload.turnOnAt;
        if (payload.turnOffAt) body.offTime = payload.turnOffAt;
        if (payload.daysOfWeek) body.daysOfWeek = payload.daysOfWeek;
    }

    return createAutomation(body);
}
