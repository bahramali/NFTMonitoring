import {useEffect, useMemo, useRef} from "react";
import {Client} from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getWsHttpUrl } from '../config/apiBase.js';

let sharedClient = null;
let isConnected = false;
const reconnectListeners = new Set(); // called on every (re)connect
const connectListeners = new Set();
const disconnectListeners = new Set();
const errorListeners = new Set();
let lastConnectHeadersKey = "";

const DEFAULT_SOCKJS_URL = getWsHttpUrl();

function normalizeSockJsUrl(url) {
    let sockJsUrl = url || DEFAULT_SOCKJS_URL;
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

function buildHeadersKey(headers) {
    if (!headers || typeof headers !== "object") return "";
    return JSON.stringify(Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)));
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
        connectListeners.forEach((fn) => {
            try {
                fn(frame);
            } catch {
                /* ignore */
            }
        });
        prevOnConnect?.(frame);
    };
    const prevOnClose = client.onWebSocketClose;
    client.onWebSocketClose = (evt) => {
        isConnected = false;
        disconnectListeners.forEach((fn) => {
            try {
                fn(evt);
            } catch {
                /* ignore */
            }
        });
        prevOnClose?.(evt);
    };
    const prevOnError = client.onWebSocketError;
    client.onWebSocketError = (evt) => {
        errorListeners.forEach((fn) => {
            try {
                fn(evt);
            } catch {
                /* ignore */
            }
        });
        prevOnError?.(evt);
    };
    const prevOnStompError = client.onStompError;
    client.onStompError = (frame) => {
        errorListeners.forEach((fn) => {
            try {
                fn(frame);
            } catch {
                /* ignore */
            }
        });
        if (prevOnStompError) {
            prevOnStompError(frame);
        } else {
            // eslint-disable-next-line no-console
            console.error("STOMP error:", frame.headers?.message, frame.body);
        }
    };
}

function ensureClient(opts = {}) {
    // external singleton first (if app already created it)
    const external = (typeof window !== "undefined") && (window.__hlStomp || window.hydroLeafStomp || opts.client);
    if (external && !sharedClient) {
        sharedClient = external;
        const nextKey = buildHeadersKey(opts.connectHeaders);
        if (nextKey !== lastConnectHeadersKey) {
            lastConnectHeadersKey = nextKey;
            if (opts.connectHeaders) {
                sharedClient.connectHeaders = opts.connectHeaders;
            }
            if (opts.reconnectOnHeaderChange && sharedClient.connected) {
                sharedClient.deactivate().then(() => sharedClient.activate()).catch(() => sharedClient.activate());
            }
        }
        attachReconnect(sharedClient);
        // if already connected, trigger listeners shortly after
        if (sharedClient.connected) {
            isConnected = true;
            setTimeout(() => {
                reconnectListeners.forEach((fn) => {
                    try {
                        fn();
                    } catch {
                        /* ignore */
                    }
                });
                connectListeners.forEach((fn) => {
                    try {
                        fn();
                    } catch {
                        /* ignore */
                    }
                });
            }, 0);
        }
        return sharedClient;
    }

    if (sharedClient) {
        const nextKey = buildHeadersKey(opts.connectHeaders);
        if (nextKey !== lastConnectHeadersKey) {
            lastConnectHeadersKey = nextKey;
            if (opts.connectHeaders) {
                sharedClient.connectHeaders = opts.connectHeaders;
            }
            if (opts.reconnectOnHeaderChange && sharedClient.connected) {
                sharedClient.deactivate().then(() => sharedClient.activate()).catch(() => sharedClient.activate());
            }
        }
        return sharedClient;
    }

    const sockJsUrl = normalizeSockJsUrl(opts.url);
    sharedClient = new Client({
        webSocketFactory: () => new SockJS(sockJsUrl),
        connectHeaders: opts.connectHeaders ?? {},
        reconnectDelay: opts.reconnectDelay ?? 3000,
        heartbeatIncoming: opts.heartbeatIncoming ?? 10000,
        heartbeatOutgoing: opts.heartbeatOutgoing ?? 10000,
        debug: () => {
            /* no-op */
        },
    });
    attachReconnect(sharedClient);
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
                        if (typeof payload === "string") {
                            const cleaned = payload.replace(/\u0000/g, "").trim();
                            try {
                                payload = JSON.parse(cleaned);
                            } catch {
                                payload = cleaned;
                            }
                        }
                        const topicName = dest.startsWith("/topic/") ? dest.slice(7) : dest;
                        handlerRef.current?.(topicName, payload, {
                            destination: dest,
                            raw: frame?.body,
                        });
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
        if (typeof opts.onDisconnect === "function") {
            disconnectListeners.add(opts.onDisconnect);
        }
        if (typeof opts.onConnect === "function") {
            connectListeners.add(opts.onConnect);
        }
        if (typeof opts.onError === "function") {
            errorListeners.add(opts.onError);
        }
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
            if (typeof opts.onDisconnect === "function") {
                disconnectListeners.delete(opts.onDisconnect);
            }
            if (typeof opts.onConnect === "function") {
                connectListeners.delete(opts.onConnect);
            }
            if (typeof opts.onError === "function") {
                errorListeners.delete(opts.onError);
            }
            // DO NOT disconnect the shared client here
        };
    }, [client, opts.onConnect, opts.onDisconnect, opts.onError, topicsKey]);
}
