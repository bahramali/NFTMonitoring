import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch, parseApiResponse } from "../../api/http.js";
import { getApiBaseUrl } from "../../config/apiBase.js";
import { useStomp } from "../../hooks/useStomp.js";
import { normalizeDeviceCatalog } from "../Reports/utils/catalog.js";
import { HYDROLEAF_TOPICS } from "../../utils/telemetryAdapter.js";
import {
    getInventoryAttributes,
    getIdentityFromMessage,
    getTimestampFromMessage,
    resolvePayload,
} from "./hallData.js";
import { buildDeviceKey, describeIdentity, isIdentityComplete } from "../../utils/deviceIdentity.js";

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

const createRackSnapshot = () => ({
    layers: new Set(),
    layerCounts: new Map(),
    deviceCounts: { C: 0, T: 0, R: 0 },
    deviceTotal: 0,
    lastUpdate: 0,
});

export function useHallInventory({ enableFallback = true, subscribeToTelemetry = true } = {}) {
    const cacheRef = useRef(new Map());
    const inventoryRef = useRef({ racks: new Map(), unmappedCount: 0 });
    const [cacheEntries, setCacheEntries] = useState([]);
    const [inventoryVersion, setInventoryVersion] = useState(0);
    const [telemetryVersion, setTelemetryVersion] = useState(0);
    const [fallbackStatus, setFallbackStatus] = useState({ loading: false, error: "" });
    const hasRealtimeIdentityRef = useRef(false);
    const providerLoggedRef = useRef(false);

    const updateInventoryForEntry = useCallback((prevEntry, nextEntry) => {
        const updateRackCounts = (rack, layer, deviceKind, delta) => {
            if (layer) {
                const current = rack.layerCounts.get(layer) || 0;
                const next = Math.max(0, current + delta);
                if (next === 0) {
                    rack.layerCounts.delete(layer);
                    rack.layers.delete(layer);
                } else {
                    rack.layerCounts.set(layer, next);
                    rack.layers.add(layer);
                }
            }

            if (deviceKind) {
                const current = rack.deviceCounts[deviceKind] || 0;
                const next = Math.max(0, current + delta);
                rack.deviceCounts[deviceKind] = next;
            }
        };

        const prevInfo = prevEntry ? getInventoryAttributes(prevEntry) : null;
        const nextInfo = nextEntry ? getInventoryAttributes(nextEntry) : null;
        const inventory = inventoryRef.current;
        let rackListChanged = false;

        if (prevInfo?.rackId && !nextInfo?.rackId) {
            inventory.unmappedCount += 1;
        } else if (!prevInfo?.rackId && nextInfo?.rackId) {
            inventory.unmappedCount = Math.max(0, inventory.unmappedCount - 1);
        }

        const ensureRack = (rackId) => {
            const existing = inventory.racks.get(rackId);
            if (existing) return existing;
            const snapshot = createRackSnapshot();
            inventory.racks.set(rackId, snapshot);
            rackListChanged = true;
            return snapshot;
        };

        const removeFromRack = (info) => {
            if (!info?.rackId) return;
            const rack = inventory.racks.get(info.rackId);
            if (!rack) return;
            updateRackCounts(rack, info.layer, info.deviceKind, -1);
            rack.deviceTotal = Math.max(0, rack.deviceTotal - 1);
            if (rack.deviceTotal === 0 && rack.layerCounts.size === 0) {
                inventory.racks.delete(info.rackId);
                rackListChanged = true;
            }
        };

        const addToRack = (info) => {
            if (!info?.rackId) return;
            const rack = ensureRack(info.rackId);
            updateRackCounts(rack, info.layer, info.deviceKind, 1);
            rack.deviceTotal += 1;
            rack.lastUpdate = Math.max(rack.lastUpdate || 0, info.timestamp || 0);
        };

        if (!nextInfo?.rackId) {
            if (prevInfo?.rackId) {
                removeFromRack(prevInfo);
            }
            return { rackListChanged };
        }

        if (prevInfo?.rackId && prevInfo.rackId !== nextInfo.rackId) {
            removeFromRack(prevInfo);
            addToRack(nextInfo);
            return { rackListChanged };
        }

        if (!prevInfo?.rackId) {
            addToRack(nextInfo);
            return { rackListChanged };
        }

        const rack = ensureRack(nextInfo.rackId);
        if (prevInfo.layer !== nextInfo.layer) {
            updateRackCounts(rack, prevInfo.layer, null, -1);
            updateRackCounts(rack, nextInfo.layer, null, 1);
        }
        if (prevInfo.deviceKind !== nextInfo.deviceKind) {
            updateRackCounts(rack, null, prevInfo.deviceKind, -1);
            updateRackCounts(rack, null, nextInfo.deviceKind, 1);
        }
        rack.lastUpdate = Math.max(rack.lastUpdate || 0, nextInfo.timestamp || 0);

        return { rackListChanged };
    }, []);

    const applyCacheEntries = useCallback(
        (entries) => {
            if (!entries.length) return;
            let rackListChanged = false;
            entries.forEach(({ cacheKey, entry }) => {
                const prevEntry = cacheRef.current.get(cacheKey);
                cacheRef.current.set(cacheKey, entry);
                const result = updateInventoryForEntry(prevEntry, entry);
                rackListChanged = rackListChanged || result.rackListChanged;
            });
            if (rackListChanged) {
                setInventoryVersion((prev) => prev + 1);
            }
            if (subscribeToTelemetry) {
                setCacheEntries(Array.from(cacheRef.current.values()));
                setTelemetryVersion((prev) => prev + 1);
            }
        },
        [subscribeToTelemetry, updateInventoryForEntry],
    );

    const handleMessage = useCallback((topic, message, meta = {}) => {
        const identity = getIdentityFromMessage(message);
        const described = describeIdentity(identity);
        const deviceKey = buildDeviceKey(identity);
        const rackId = described.unitType === "rack" ? described.unitId : null;
        const layerId = described.layerId ?? null;

        // eslint-disable-next-line no-console
        console.log(
            `[WS][IN]\ntopic=${meta.destination ?? topic}\nfarmId=${described.farmId ?? "null"}\nunitType=${described.unitType ?? "null"}\nunitId=${described.unitId ?? "null"}\nlayerId=${layerId ?? "null"}`,
        );
        // eslint-disable-next-line no-console
        console.log(
            `[IDENTITY]\nkey=${deviceKey ?? "null"}\nidentity=${JSON.stringify(described)}`,
        );

        if (isIdentityComplete(identity)) {
            hasRealtimeIdentityRef.current = true;
        }
        const cacheKey = deviceKey || "UNMAPPED";
        const timestamp = getTimestampFromMessage(message) ?? Date.now();
        const payload = resolvePayload(message);
        const entry = {
            deviceKey: deviceKey || null,
            identity: described,
            message: payload ?? message,
            timestamp,
        };
        applyCacheEntries([{ cacheKey, entry }]);
    }, [applyCacheEntries]);

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

            const fallbackEntries = devices
                .map((device, index) => {
                    const identity = getIdentityFromMessage(device);
                    const deviceKey = buildDeviceKey(identity);
                    const cacheKey = deviceKey || `UNMAPPED-${index}`;
                    if (cacheRef.current.has(cacheKey)) return null;
                    return {
                        cacheKey,
                        entry: {
                            deviceKey: deviceKey || null,
                            identity: describeIdentity(identity),
                            message: resolvePayload(device) ?? device,
                            timestamp: getTimestampFromMessage(device) ?? timestamp,
                        },
                    };
                })
                .filter(Boolean);
            applyCacheEntries(fallbackEntries);
            setFallbackStatus({ loading: false, error: "" });
        } catch (error) {
            setFallbackStatus({ loading: false, error: error?.message ?? "Failed to load devices" });
        }
    }, []);

    useEffect(() => {
        if (!enableFallback) return undefined;
        const timer = setTimeout(() => {
            if (!hasRealtimeIdentityRef.current) {
                loadFallback();
            }
        }, FALLBACK_DELAY_MS);
        return () => clearTimeout(timer);
    }, [enableFallback, loadFallback]);

    const inventory = useMemo(() => inventoryRef.current, [inventoryVersion, telemetryVersion]);

    return {
        cache: cacheRef.current,
        cacheEntries,
        inventory,
        unmappedCount: inventory.unmappedCount,
        fallbackStatus,
        inventoryVersion,
        telemetryVersion,
    };
}
