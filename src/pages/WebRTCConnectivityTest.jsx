import React, { useEffect, useRef } from 'react';

const resolveSignalingBaseUrl = () => {
    if (import.meta.env.REACT_APP_WEBRTC_SIGNALING_URL) {
        return import.meta.env.REACT_APP_WEBRTC_SIGNALING_URL;
    }
    if (import.meta.env.VITE_MEDIAMTX_WEBRTC_ENDPOINT) {
        return import.meta.env.VITE_MEDIAMTX_WEBRTC_ENDPOINT;
    }
    if (import.meta.env.DEV) {
        return import.meta.env.VITE_MEDIAMTX_WEBRTC_ENDPOINT_DEV || '';
    }
    return '';
};

const buildSignalingUrl = (baseUrl, streamName) => {
    if (!baseUrl) {
        throw new Error(
            'Missing WebRTC signaling base URL. Set VITE_MEDIAMTX_WEBRTC_ENDPOINT (or VITE_MEDIAMTX_WEBRTC_ENDPOINT_DEV in dev).'
        );
    }
    const fallbackBase = baseUrl;
    const encodedStream = encodeURIComponent(streamName);

    try {
        const url = new URL(fallbackBase);
        const hasWebRtcEndpoint = url.pathname.endsWith('/v2/webrtc');
        if (!hasWebRtcEndpoint) {
            const normalizedPath = url.pathname.endsWith('/')
                ? url.pathname.slice(0, -1)
                : url.pathname;
            url.pathname = `${normalizedPath}/v2/webrtc`;
        }
        if (streamName) {
            url.searchParams.set('path', streamName);
        }
        return url.toString();
    } catch {
        const normalizedBase = fallbackBase.replace(/\/$/, '');
        const query = streamName ? `?path=${encodedStream}` : '';
        return `${normalizedBase}/v2/webrtc${query}`;
    }
};

function WebRTCConnectivityTest({ streamName = 'stream' }) {
    const videoRef = useRef(null);
    const streamRef = useRef(new MediaStream());

    useEffect(() => {
        const peerConnection = new RTCPeerConnection();
        const abortController = new AbortController();
        const signalingBaseUrl = resolveSignalingBaseUrl();
        if (!signalingBaseUrl) {
            console.error(
                'WebRTC signaling base URL is not configured. Set VITE_MEDIAMTX_WEBRTC_ENDPOINT.'
            );
            return undefined;
        }
        const signalingUrl = buildSignalingUrl(signalingBaseUrl, streamName);

        peerConnection.addTransceiver('video', { direction: 'recvonly' });

        const logConnectionState = () => {
            console.log('WebRTC connection state:', peerConnection.connectionState);
        };

        const logIceConnectionState = () => {
            console.log('WebRTC ICE connection state:', peerConnection.iceConnectionState);
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
        peerConnection.addEventListener('iceconnectionstatechange', logIceConnectionState);
        peerConnection.addEventListener('track', handleTrackEvent);
        peerConnection.addEventListener('addstream', handleLegacyStream);

        const runConnectivityTest = async () => {
            try {
                console.log('Starting WebRTC connectivity test.');
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                const response = await fetch(signalingUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: peerConnection.localDescription?.type,
                        sdp: peerConnection.localDescription?.sdp,
                    }),
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    throw new Error(
                        `Signaling request failed with status ${response.status} ${response.statusText}`
                    );
                }

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
            } catch (error) {
                if (error?.name === 'AbortError') {
                    console.warn('WebRTC signaling request was aborted.');
                    return;
                }
                console.error('WebRTC connectivity test failed during signaling.', error);
                throw error;
            }
        };

        runConnectivityTest().catch((error) => {
            console.error('WebRTC connectivity test failed.', error);
        });

        return () => {
            abortController.abort();
            peerConnection.removeEventListener('connectionstatechange', logConnectionState);
            peerConnection.removeEventListener('iceconnectionstatechange', logIceConnectionState);
            peerConnection.removeEventListener('track', handleTrackEvent);
            peerConnection.removeEventListener('addstream', handleLegacyStream);
            streamRef.current?.getTracks?.().forEach((track) => {
                track.stop();
            });
            peerConnection.getReceivers().forEach((receiver) => {
                if (receiver.track) {
                    receiver.track.stop();
                }
            });
            peerConnection.getSenders().forEach((sender) => {
                if (sender.track) {
                    sender.track.stop();
                }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            peerConnection.close();
        };
    }, [streamName]);

    return (
        <div>
            <h1>WebRTC Connectivity Test</h1>
            <p>Open the console to see connection state logs.</p>
            <video ref={videoRef} autoPlay playsInline />
        </div>
    );
}

export default WebRTCConnectivityTest;
