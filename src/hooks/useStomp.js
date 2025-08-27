// useStomp.js
import { useEffect, useMemo, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";

function normalizeWsUrl(url) {
  let wsUrl = url || import.meta.env.VITE_WS_URL || "wss://api.hydroleaf.se/ws";
  if (typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      wsUrl.startsWith("ws://")) {
    wsUrl = "wss://" + wsUrl.slice(5);
  }
  return wsUrl;
}

/**
 * Subscribe to one or more topics via STOMP and call onMessage(topic, data).
 * data: tries JSON.parse, falls back to raw string.
 */
export function useStomp(topics, onMessage, opts = {}) {
  const topicsArr = useMemo(
    () => (Array.isArray(topics) ? topics : [topics]).filter(Boolean),
    [topics]
  );
  const topicsKey = topicsArr.join("|");
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [connected, setConnected] = useState(false);

    useEffect(() => {
    const client = new Client({
      brokerURL: normalizeWsUrl(opts.url),
      reconnectDelay: opts.reconnectDelay ?? 3000,
      heartbeatIncoming: opts.heartbeatIncoming ?? 10000,
      heartbeatOutgoing: opts.heartbeatOutgoing ?? 10000,
      debug: () => {}, // silent
    });

    let subs = [];

    client.onConnect = () => {
      setConnected(true);
      subs = topicsArr.map((t) => {
        const destination = t.startsWith("/") ? t : `/topic/${t}`;
        return client.subscribe(destination, (message) => {
          const body = message.body;
          let data = body;
          try { data = JSON.parse(body); } catch {
            // ignore parse errors
          }
          onMessageRef.current?.(t, data);
        });
      });
    };

    client.onWebSocketClose = () => setConnected(false);
    client.onStompError = (frame) =>
      console.error("STOMP error:", frame.headers?.message, frame.body);

    client.activate();

        return () => {
      subs.forEach((s) => s?.unsubscribe?.());
      client.deactivate();
        };
  }, [
    topicsArr,
    topicsKey,
    opts.url,
    opts.reconnectDelay,
    opts.heartbeatIncoming,
    opts.heartbeatOutgoing,
  ]);

  return { connected };
}
