import React, { useEffect } from 'react';

const SIGNALING_URL =
    import.meta.env.VITE_MEDIAMTX_WEBRTC_ENDPOINT || 'http://localhost:8889/v2/webrtc';

function WebRTCConnectivityTest() {
    useEffect(() => {
        const peerConnection = new RTCPeerConnection();

        peerConnection.addTransceiver('video', { direction: 'recvonly' });

        const logConnectionState = () => {
            console.log('WebRTC connection state:', peerConnection.connectionState);
        };

        peerConnection.addEventListener('connectionstatechange', logConnectionState);

        const runConnectivityTest = async () => {
            console.log('Starting WebRTC connectivity test.');
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            const response = await fetch(SIGNALING_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: peerConnection.localDescription?.type,
                    sdp: peerConnection.localDescription?.sdp,
                }),
            });

            let answerSdp = '';
            let answerType = 'answer';
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await response.json();
                answerSdp = data?.sdp || data?.answer || '';
                answerType = data?.type || 'answer';
            } else {
                answerSdp = await response.text();
            }

            if (!answerSdp) {
                console.warn('MediaMTX did not return an SDP answer.');
                return;
            }

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription({ type: answerType, sdp: answerSdp })
            );
        };

        runConnectivityTest().catch((error) => {
            console.error('WebRTC connectivity test failed.', error);
        });

        return () => {
            peerConnection.removeEventListener('connectionstatechange', logConnectionState);
            peerConnection.close();
        };
    }, []);

    return (
        <div>
            <h1>WebRTC Connectivity Test</h1>
            <p>Open the console to see connection state logs.</p>
        </div>
    );
}

export default WebRTCConnectivityTest;
