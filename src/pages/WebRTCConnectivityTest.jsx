import React, { useEffect, useRef } from 'react';

const SIGNALING_URL =
    import.meta.env.VITE_MEDIAMTX_WEBRTC_ENDPOINT || 'http://localhost:8889/v2/webrtc';

function WebRTCConnectivityTest() {
    const videoRef = useRef(null);
    const streamRef = useRef(new MediaStream());

    useEffect(() => {
        const peerConnection = new RTCPeerConnection();

        peerConnection.addTransceiver('video', { direction: 'recvonly' });

        const logConnectionState = () => {
            console.log('WebRTC connection state:', peerConnection.connectionState);
        };

        const attachStreamToVideo = (stream) => {
            const videoElement = videoRef.current;

            if (!videoElement || !stream) {
                return;
            }

            if (videoElement.srcObject !== stream) {
                videoElement.srcObject = stream;
            }

            const playPromise = videoElement.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        };

        const handleTrackEvent = (event) => {
            if (event.streams && event.streams[0]) {
                streamRef.current = event.streams[0];
                attachStreamToVideo(event.streams[0]);
                return;
            }

            if (event.track) {
                streamRef.current.addTrack(event.track);
                attachStreamToVideo(streamRef.current);
            }
        };

        const handleLegacyStream = (event) => {
            if (event.stream) {
                streamRef.current = event.stream;
                attachStreamToVideo(event.stream);
            }
        };

        peerConnection.addEventListener('connectionstatechange', logConnectionState);
        peerConnection.addEventListener('track', handleTrackEvent);
        peerConnection.addEventListener('addstream', handleLegacyStream);

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
            peerConnection.removeEventListener('track', handleTrackEvent);
            peerConnection.removeEventListener('addstream', handleLegacyStream);
            peerConnection.close();
        };
    }, []);

    return (
        <div>
            <h1>WebRTC Connectivity Test</h1>
            <p>Open the console to see connection state logs.</p>
            <video ref={videoRef} autoPlay playsInline />
        </div>
    );
}

export default WebRTCConnectivityTest;
