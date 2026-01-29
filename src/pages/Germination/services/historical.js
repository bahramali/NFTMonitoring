import { authFetch } from "../../../api/http.js";
import { transformAggregatedData } from "../../../utils.js";
import { getEntryValue } from "../germinationUtils.js";
import { TELEMETRY_ENDPOINTS } from "../../../config/telemetryEndpoints.js";

export async function fetchHistorical({
    compositeId,
    from,
    to,
    sensorType,
    metricKey,
    signal,
}) {
    const params = new URLSearchParams({
        compositeId,
        from: from.toISOString(),
        to: to.toISOString(),
    });
    if (sensorType) {
        params.append("sensorType", sensorType);
    }

    const response = await authFetch(
        `${TELEMETRY_ENDPOINTS.rest.historyAggregated}?${params.toString()}`,
        { signal },
    );
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    const json = await response.json();
    const entries = transformAggregatedData(json);
    const points = entries
        .map((entry) => ({
            time: entry.timestamp,
            value: getEntryValue(entry, metricKey),
        }))
        .filter((point) => point.value !== null);

    return points;
}
