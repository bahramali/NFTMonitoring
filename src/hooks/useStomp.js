import { useEffect } from 'react';
import { parseSensorJson } from '../utils';

export function useStomp(topics, onMessage) {
    const topicsKey = JSON.stringify(Array.isArray(topics) ? topics : [topics]);
    useEffect(() => {
        const topicList = JSON.parse(topicsKey);

        let wsUrl = import.meta.env.VITE_WS_URL || 'wss://api.hydroleaf.se/ws';
        if (location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
            wsUrl = 'wss://' + wsUrl.slice(5);
        }

        let socket;
        let buffer = '';

        const buildFrame = (command, headers = {}, body = '') => {
            let frame = command + '\n';
            for (const [k, v] of Object.entries(headers)) {
                frame += `${k}:${v}\n`;
            }
            return frame + '\n' + body + '\0';
        };

        const handleFrame = (frame) => {
            console.log("Raw STOMP frame received:", frame);
            console.log("frame.command:", frame.command);
            if (frame.command === 'CONNECTED') {
                topicList.forEach((t, idx) => {
                    const dest = `/topic/${t}`;
                    console.log("🟢 Sending SUBSCRIBE to:", dest);
                    socket.send(
                        buildFrame('SUBSCRIBE', {
                            id: `sub-${idx}`,
                            destination: dest,
                            ack: 'auto'
                        })
                    );
                });
                return;
            }
            if (frame.command === 'MESSAGE') {
                console.log("📦 MESSAGE frame body:", frame.body);

                const dest = frame.headers.destination || '';
                console.log("📍 Destination:", dest);

                const match = dest.match(/\/topic\/(.+)/);
                const topic = match ? match[1] : '';
                try {
                    const parsed = parseSensorJson(frame.body);
                    console.log("✅ Parsed payload:", parsed);
                    onMessage(topic, parsed);
                } catch (e) {
                    console.error('❌ Invalid STOMP message', e);
                }
            }
        };

        const processData = (data) => {
            buffer += data;
            console.log("🔹 Raw STOMP chunk:", data);
            while (true) {
                const nullIdx = buffer.indexOf('\0');
                if (nullIdx === -1) break;
                const frameStr = buffer.slice(0, nullIdx);
                console.log("🔸 Extracted STOMP frame:", frameStr);
                buffer = buffer.slice(nullIdx + 1);
                const idx = frameStr.indexOf('\n\n');
                if (idx === -1) continue;
                const headerLines = frameStr.slice(0, idx).split('\n');
                const command = headerLines.shift();
                const headers = {};
                for (const line of headerLines) {
                    if (!line) continue;
                    const i = line.indexOf(':');
                    if (i > 0) headers[line.slice(0, i)] = line.slice(i + 1);
                }
                const body = frameStr.slice(idx + 2);
                console.log("📦 STOMP Frame => command:", command,
                    "headers:", JSON.stringify(headers, null, 2),
                    "body:", body);
                handleFrame({command, headers, body});
            }
        };

        socket = new WebSocket(wsUrl);

        socket.addEventListener('open', () => {
            socket.send(
                buildFrame('CONNECT', {
                    'accept-version': '1.2',
                    host: location.hostname,
                    'heart-beat': '0,0'
                })
            );
        });

        socket.addEventListener('message', (event) => {
            console.log('Received message', event.data);
            processData(event.data);
        });

        socket.addEventListener('error', (e) => {
            console.error('WebSocket error', e);
        });

        socket.addEventListener('close', () => {
            console.warn('WebSocket closed');
        });

        return () => {
            if (socket) socket.close();
        };
    }, [topicsKey, onMessage]);
}
