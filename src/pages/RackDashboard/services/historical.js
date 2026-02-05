import { authFetch } from "../../../api/http.js";
import { transformAggregatedData } from "../../../utils.js";
import { getEntryValue } from "../../Germination/germinationUtils.js";
import { TELEMETRY_ENDPOINTS } from "../../../config/telemetryEndpoints.js";
import { describeIdentity } from "../../../utils/deviceIdentity.js";

function normalizeTimestamp(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
}

function normalizePoint(entry) {
    if (!entry || typeof entry !== "object") return null;
    const timestamp = normalizeTimestamp(entry.timestamp ?? entry.time ?? entry.ts ?? entry.t);
    const rawValue = entry.value ?? entry.metricValue ?? entry.y;
    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(value) || timestamp === null) return null;
    return { time: timestamp, value };
}

function toPointsFromEntries(entries, metricKey) {
    return entries
        .map((entry) => {
            const time = normalizeTimestamp(entry.timestamp ?? entry.time ?? entry.ts ?? entry.t);
            const value = getEntryValue(entry, metricKey);
            if (time === null || value === null) return null;
            return { time, value };
        })
        .filter(Boolean);
}

export async function fetchHistorical({
    identity,
    metricKey,
    sensorType,
    from,
    to,
    signal,
}) {
    const resolvedSensorType = sensorType || metricKey;
    const described = describeIdentity(identity || {});
    const params = new URLSearchParams({
        sensorType: resolvedSensorType,
        from: from.toISOString(),
        to: to.toISOString(),
    });
    Object.entries(described).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") return;
        params.set(key, String(value));
    });

    const response = await authFetch(
        `${TELEMETRY_ENDPOINTS.rest.historyAggregated}?${params.toString()}`,
        { signal },
    );
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    const json = await response.json();

    if (Array.isArray(json)) {
        return json.map(normalizePoint).filter(Boolean);
    }

    if (Array.isArray(json?.data)) {
        return json.data.map(normalizePoint).filter(Boolean);
    }

    if (Array.isArray(json?.entries)) {
        return json.entries.map(normalizePoint).filter(Boolean);
    }

    const entries = transformAggregatedData(json);
    return toPointsFromEntries(entries, metricKey || resolvedSensorType);
}
