// hooks/useStomp.js
// Robust STOMP hook with stable subscriptions and a shared client.
// - Does NOT disconnect the client on each unmount
// - Subscribes only to changed topics
// - Resubscribes on reconnect automatically

import { useEffect, useMemo, useRef } from "react";
import { Client } from "@stomp/stompjs";

// ---- shared client (singleton) ----
let sharedClient = null;
let isConnected = false;
const reconnectListeners = new Set(); // functions executed on every (re)connect

function normalizeWsUrl(url) {
  let wsUrl = url || (typeof import.meta !== "undefined" ? import.meta.env?.VITE_WS_URL : undefined) || "wss://api.hydroleaf.se/ws";
  if (typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      wsUrl.startsWith("ws://")) {
    wsUrl = "wss://" + wsUrl.slice(5);
  }
  return wsUrl;
}

function ensureClient(opts = {}) {
  if (sharedClient) return sharedClient;
  sharedClient = new Client({
      brokerURL: normalizeWsUrl(opts.url),
      reconnectDelay: opts.reconnectDelay ?? 3000,
      heartbeatIncoming: opts.heartbeatIncoming ?? 10000,
      heartbeatOutgoing: opts.heartbeatOutgoing ?? 10000,
    debug: () => {}, // silence
    });

  sharedClient.onConnect = () => {
    isConnected = true;
    // notify all hooks to (re)establish their subs
    reconnectListeners.forEach((fn) => {
      try { fn(); } catch {}
      });
    };
  sharedClient.onWebSocketClose = () => { isConnected = false; };
  sharedClient.onStompError = (frame) => {
    // eslint-disable-next-line no-console
      console.error("STOMP error:", frame.headers?.message, frame.body);
  };

  sharedClient.activate();
  return sharedClient;
}

/**
 * Subscribe to one or more topics. onMessage(topic, data)
 * - topics: string | string[] (can be full destination "/topic/xxx" or shorthand "xxx")
 */
export function useStomp(topics, onMessage, opts = {}) {
  // normalize topics and keep a stable key
  const topicsArr = useMemo(() => {
    const list = Array.isArray(topics) ? topics : [topics];
    return [...new Set(list.filter(Boolean))];
  }, [topics]);
  const topicsKey = useMemo(() => JSON.stringify(topicsArr), [topicsArr]);

  const subsRef = useRef({}); // destination -> subscription
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const client = ensureClient(opts);

  useEffect(() => {
    if (!client) return;

    // subscribe only to missing topics; keep others
    const setup = () => {
      const wanted = new Set(
        (topicsArr || []).map((t) => (t?.startsWith("/") ? t : `/topic/${t}`))
      );

      // add new
      wanted.forEach((dest) => {
        if (!subsRef.current[dest]) {
          subsRef.current[dest] = client.subscribe(dest, (frame) => {
            let payload = frame?.body;
            try { payload = typeof payload === "string" ? JSON.parse(payload) : payload; } catch {}
            // pass back shorthand topic if possible
            const topicName = dest.startsWith("/topic/") ? dest.slice(7) : dest;
            handlerRef.current?.(topicName, payload);
          });
        }
      });

      // remove obsolete
      Object.keys(subsRef.current).forEach((dest) => {
        if (!wanted.has(dest)) {
          try { subsRef.current[dest].unsubscribe?.(); } catch {}
          delete subsRef.current[dest];
        }
      });
    };

    // register for reconnects
    reconnectListeners.add(setup);
    // if currently connected, do it now
    if (isConnected) setup();

        return () => {
      // cleanup only this hook's subs
      Object.values(subsRef.current).forEach((s) => {
        try { s.unsubscribe?.(); } catch {}
      });
      subsRef.current = {};
      reconnectListeners.delete(setup);
      // DO NOT deactivate shared client here
        };
  }, [client, topicsKey]);

  // no return needed, but could expose connection state later
  return undefined;
}
