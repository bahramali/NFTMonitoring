import {useEffect, useMemo, useRef} from "react";
import {Client} from "@stomp/stompjs";

let sharedClient = null;
let isConnected = false;
const reconnectListeners = new Set(); // called on every (re)connect

function normalizeWsUrl(url) {
    let wsUrl = url || (typeof import.meta !== "undefined" ? import.meta.env?.VITE_WS_URL : undefined);
    if (!wsUrl && typeof window !== "undefined") {
        // try to build from current origin if not provided
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        wsUrl = `${proto}://${window.location.host}/ws`;
    }
    return wsUrl;
}

function attachReconnect(client) {
    const prevOnConnect = client.onConnect;
    client.onConnect = (frame) => {
        isConnected = true;
        reconnectListeners.forEach((fn) => {
            try {
                fn();
            } catch {
            }
        });
        prevOnConnect?.(frame);
    };
    const prevOnClose = client.onWebSocketClose;
    client.onWebSocketClose = (evt) => {
        isConnected = false;
        prevOnClose?.(evt);
    };
}

function ensureClient(opts = {}) {
    // external singleton first (if app already created it)
    const external = (typeof window !== "undefined") && (window.__hlStomp || window.hydroLeafStomp || opts.client);
    if (external && !sharedClient) {
        sharedClient = external;
        attachReconnect(sharedClient);
        // if already connected, trigger listeners shortly after
        if (sharedClient.connected) {
            isConnected = true;
            setTimeout(() => reconnectListeners.forEach((fn) => {
                try {
                    fn();
                } catch {
                }
            }), 0);
        }
        return sharedClient;
    }

    if (sharedClient) return sharedClient;

    const brokerURL = normalizeWsUrl(opts.url);
    sharedClient = new Client({
        brokerURL,
        reconnectDelay: opts.reconnectDelay ?? 3000,
        heartbeatIncoming: opts.heartbeatIncoming ?? 10000,
        heartbeatOutgoing: opts.heartbeatOutgoing ?? 10000,
        debug: () => {
        },
    });
    attachReconnect(sharedClient);
    sharedClient.onStompError = (frame) => {
        // eslint-disable-next-line no-console
        console.error("STOMP error:", frame.headers?.message, frame.body);
    };
    sharedClient.activate();
    return sharedClient;
}

/**
 * useStomp(topics, onMessage, opts?)
 * topics: string | string[] ("/topic/x" or "x")
 * onMessage: (topic, data) => void
 */
export function useStomp(topics, onMessage, opts = {}) {
    const topicsArr = useMemo(() => {
        const list = Array.isArray(topics) ? topics : [topics];
        return [...new Set(list.filter(Boolean))];
    }, [topics]);
    const topicsKey = useMemo(() => JSON.stringify(topicsArr), [topicsArr]);

    const subsRef = useRef({}); // dest -> subscription
    const handlerRef = useRef(onMessage);
    handlerRef.current = onMessage;

    const client = ensureClient(opts);

    useEffect(() => {
        if (!client) return;

        const setup = () => {
            const wanted = new Set((topicsArr || []).map((t) => (t?.startsWith("/") ? t : `/topic/${t}`)));

            // add new
            wanted.forEach((dest) => {
                if (!subsRef.current[dest]) {
                    subsRef.current[dest] = client.subscribe(dest, (frame) => {
                        let payload = frame?.body;
                        try {
                            payload = typeof payload === "string" ? JSON.parse(payload) : payload;
                        } catch {
                        }
                        const topicName = dest.startsWith("/topic/") ? dest.slice(7) : dest;
                        handlerRef.current?.(topicName, payload);
                    });
                }
            });

            // remove obsolete
            Object.keys(subsRef.current).forEach((dest) => {
                if (!wanted.has(dest)) {
                    try {
                        subsRef.current[dest].unsubscribe?.();
                    } catch {
                    }
                    delete subsRef.current[dest];
                }
            });
        };

        reconnectListeners.add(setup);
        if (isConnected) setup();

        return () => {
            Object.values(subsRef.current).forEach((s) => {
                try {
                    s.unsubscribe?.();
                } catch {
                }
            });
            subsRef.current = {};
            reconnectListeners.delete(setup);
            // DO NOT disconnect the shared client here
        };
    }, [client, topicsKey]);
}