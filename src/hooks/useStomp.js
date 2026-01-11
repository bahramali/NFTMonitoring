import {useEffect, useMemo, useRef} from "react";
import {Client} from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getApiBaseUrl } from '../config/apiBase.js';

let sharedClient = null;
let isConnected = false;
const reconnectListeners = new Set(); // called on every (re)connect

const API_BASE = getApiBaseUrl();
const DEFAULT_SOCKJS_URL = API_BASE
    ? `${API_BASE}/ws`
    : (typeof window !== "undefined" ? `${window.location.origin}/ws` : "/ws");

function normalizeSockJsUrl(url) {
    let sockJsUrl = url || (typeof import.meta !== "undefined" ? import.meta.env?.VITE_WS_HTTP_URL : undefined) || DEFAULT_SOCKJS_URL;
    if (sockJsUrl?.startsWith("/")) {
        console.warn("SockJS URL must be absolute. Falling back to default.", sockJsUrl);
        sockJsUrl = DEFAULT_SOCKJS_URL;
    }
    if (sockJsUrl?.startsWith("ws://")) {
        sockJsUrl = `http://${sockJsUrl.slice(5)}`;
    }
    if (sockJsUrl?.startsWith("wss://")) {
        sockJsUrl = `https://${sockJsUrl.slice(6)}`;
    }
    return sockJsUrl;
}

function attachReconnect(client) {
    const prevOnConnect = client.onConnect;
    client.onConnect = (frame) => {
        isConnected = true;
        reconnectListeners.forEach((fn) => {
            try {
                fn();
            } catch {
                /* ignore */
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
                    /* ignore */
                }
            }), 0);
        }
        return sharedClient;
    }

    if (sharedClient) return sharedClient;

    const sockJsUrl = normalizeSockJsUrl(opts.url);
    sharedClient = new Client({
        webSocketFactory: () => new SockJS(sockJsUrl),
        reconnectDelay: opts.reconnectDelay ?? 3000,
        heartbeatIncoming: opts.heartbeatIncoming ?? 10000,
        heartbeatOutgoing: opts.heartbeatOutgoing ?? 10000,
        debug: () => {
            /* no-op */
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
                            /* ignore */
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
                        /* ignore */
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
                    /* ignore */
                }
            });
            subsRef.current = {};
            reconnectListeners.delete(setup);
            // DO NOT disconnect the shared client here
        };
    }, [client, topicsKey]);
}
