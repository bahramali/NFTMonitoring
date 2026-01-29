import { getApiBaseUrl, getWsHttpUrl } from "./apiBase.js";
import { WS_TOPICS } from "../pages/common/dashboard.constants.js";

const API_BASE = getApiBaseUrl();

export const TELEMETRY_ENDPOINTS = {
    rest: {
        historyAggregated: `${API_BASE}/api/records/history/aggregated`,
    },
    ws: {
        baseUrl: getWsHttpUrl(),
        topics: WS_TOPICS,
    },
};
