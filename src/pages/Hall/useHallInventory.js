import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch, parseApiResponse } from "../../api/http.js";
import { getApiBaseUrl } from "../../config/apiBase.js";
import { useStomp } from "../../hooks/useStomp.js";
import { normalizeDeviceCatalog } from "../Reports/utils/catalog.js";
import { HYDROLEAF_TOPICS } from "../../utils/telemetryAdapter.js";
import {
    buildInventoryFromMessages,
    getLocationFromMessage,
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

const stringifyPayload = (value) => {
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value ?? null);
    } catch {
        return String(value);
    }
};

export function useHallInventory({ enableFallback = true } = {}) {
    const [cache, setCache] = useState(() => new Map());
    const [fallbackStatus, setFallbackStatus] = useState({ loading: false, error: "" });
    const hasRealtimeCompositeRef = useRef(false);
    const providerLoggedRef = useRef(false);

    const handleMessage = useCallback((topic, message, meta = {}) => {
        const compositeIdRaw = getCompositeIdFromMessage(message);
        const compositeId = compositeIdRaw ? normalizeCompositeId(compositeIdRaw) : null;
        const parsed = parseCompositeId(compositeIdRaw);
        const location = getLocationFromMessage(message);
        const site = location?.site ?? null;
        const rack = location?.rack ?? null;
        const layer = location?.layer ?? null;
        const payloadRaw = typeof meta.raw === "string" ? meta.raw : null;
        const payload = payloadRaw ?? stringifyPayload(message);
        const parsedOutput = {
            site: parsed?.rackId ?? null,
            layer: parsed?.layerId ?? null,
            rackId: parsed?.rackId ?? null,
            channel: parsed?.deviceCode ?? null,
        };

        // eslint-disable-next-line no-console
        console.log(
            `[WS][IN]\ntopic=${meta.destination ?? topic}\ncompositeId=${compositeId ?? "null"}\nsite=${site ?? "null"}\nrack=${rack ?? "null"}\nlayer=${layer ?? "null"}`,
        );
        // eslint-disable-next-line no-console
        console.log(
            `[PARSE]\ncompositeId=${compositeId ?? "null"}\nregexMatch=${Boolean(parsed)}\nparsed=${JSON.stringify(parsedOutput)}`,
        );

        if (parsed) {
            hasRealtimeCompositeRef.current = true;
        }
        setCache((prev) => mergeRealtimeCache(prev, message));
    }, []);

    useStomp(TOPICS, handleMessage);

    useEffect(() => {
        if (providerLoggedRef.current) return;
        providerLoggedRef.current = true;
        if (typeof window === "undefined") return;
        const hasProvider = Boolean(window.__hlStomp || window.hydroLeafStomp);
        if (!hasProvider) {
            // eslint-disable-next-line no-console
            console.log("[WS][STATUS]\nproviderActive=false\nnote=Monitoring provider not detected");
        }
    }, []);

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
    const inventory = useMemo(() => {
        // eslint-disable-next-line no-console
        console.log(`[INVENTORY]\nphase=before-build\nentries=${cacheEntries.length}`);
        const nextInventory = buildInventoryFromMessages(cacheEntries);
        // eslint-disable-next-line no-console
        console.log(`[INVENTORY]\nracksSize=${nextInventory.racks.size}`);
        return nextInventory;
    }, [cacheEntries]);

    return {
        cache,
        cacheEntries,
        inventory,
        unmappedCount: inventory.unmappedCount,
        fallbackStatus,
    };
}
