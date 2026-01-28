import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch, parseApiResponse } from "../../api/http.js";
import { getApiBaseUrl } from "../../config/apiBase.js";
import { useStomp } from "../../hooks/useStomp.js";
import { normalizeDeviceCatalog } from "../Reports/utils/catalog.js";
import { HYDROLEAF_TOPICS } from "../../utils/telemetryAdapter.js";
import {
    buildInventoryFromMessages,
    getCompositeIdFromMessage,
    getTimestampFromMessage,
    mergeRealtimeCache,
    normalizeCompositeId,
    parseCompositeId,
} from "./hallData.js";

const API_BASE = getApiBaseUrl();
const FALLBACK_DELAY_MS = 2500;
const TOPICS = HYDROLEAF_TOPICS;

const resolveDeviceList = (data) => {
    const catalog = normalizeDeviceCatalog(data);
    if (catalog?.devices?.length) return catalog.devices;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.devices)) return data.devices;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.devices)) return data.data.devices;
    if (Array.isArray(data?.catalog?.devices)) return data.catalog.devices;

    return [];
};

export function useHallInventory({ enableFallback = true } = {}) {
    const [cache, setCache] = useState(() => new Map());
    const [fallbackStatus, setFallbackStatus] = useState({ loading: false, error: "" });
    const hasRealtimeCompositeRef = useRef(false);

    const handleMessage = useCallback((_topic, message) => {
        const compositeId = getCompositeIdFromMessage(message);
        if (parseCompositeId(compositeId)) {
            hasRealtimeCompositeRef.current = true;
        }
        setCache((prev) => mergeRealtimeCache(prev, message));
    }, []);

    useStomp(TOPICS, handleMessage);

    const loadFallback = useCallback(async () => {
        if (!API_BASE) return;
        setFallbackStatus({ loading: true, error: "" });
        try {
            const response = await authFetch(`${API_BASE}/api/devices/all`);
            const data = await parseApiResponse(response, "Device catalog unavailable");
            const devices = resolveDeviceList(data);
            const timestamp = Date.now();

            setCache((prev) => {
                const next = new Map(prev);
                devices.forEach((device, index) => {
                    const compositeId = getCompositeIdFromMessage(device);
                    const normalized = normalizeCompositeId(compositeId);
                    const cacheKey = normalized || `UNMAPPED-${index}`;
                    if (next.has(cacheKey)) return;
                    next.set(cacheKey, {
                        compositeId: normalized || null,
                        message: device,
                        timestamp: getTimestampFromMessage(device) ?? timestamp,
                    });
                });
                return next;
            });
            setFallbackStatus({ loading: false, error: "" });
        } catch (error) {
            setFallbackStatus({ loading: false, error: error?.message ?? "Failed to load devices" });
        }
    }, []);

    useEffect(() => {
        if (!enableFallback) return undefined;
        const timer = setTimeout(() => {
            if (!hasRealtimeCompositeRef.current) {
                loadFallback();
            }
        }, FALLBACK_DELAY_MS);
        return () => clearTimeout(timer);
    }, [enableFallback, loadFallback]);

    const cacheEntries = useMemo(() => Array.from(cache.values()), [cache]);
    const inventory = useMemo(() => buildInventoryFromMessages(cacheEntries), [cacheEntries]);

    return {
        cache,
        cacheEntries,
        inventory,
        unmappedCount: inventory.unmappedCount,
        fallbackStatus,
    };
}
