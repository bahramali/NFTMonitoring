import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';

/**
 * Hook that connects to the WebSocket and subscribes to `/topic/live_now`.
 * Returns the latest parsed JSON payload received from the topic.
 */
export function useLiveUpdates() {
    const [payload, setPayload] = useState(null);

    useEffect(() => {
        let wsUrl = import.meta.env.VITE_WS_URL || 'wss://api.hydroleaf.se/ws';
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
            wsUrl = 'wss://' + wsUrl.slice(5);
        }

        const client = new Client({
            brokerURL: wsUrl,
            reconnectDelay: 5000,
            debug: () => {},
        });

        client.onConnect = () => {
            client.subscribe('/topic/live_now', (message) => {
                try {
                    const data = JSON.parse(message.body);
                    setPayload(data);
                } catch (e) {
                    console.error('Failed to parse live update', e);
                }
            });
        };

        client.onStompError = (frame) => {
            console.error('STOMP error', frame.headers['message']);
        };

        client.activate();

        return () => {
            client.deactivate();
        };
    }, []);

    return payload;
}
