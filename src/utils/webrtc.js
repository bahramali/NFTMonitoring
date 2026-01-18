export function buildWebRTCSignalingUrl(path) {
    const base =
        import.meta.env.VITE_WEBRTC_SIGNALING_URL ||
        import.meta.env.VITE_CAM_BASE_URL ||
        '';
    const normalizedBase = base.replace(/\/+$/, '');

    return `${normalizedBase}/v2/webrtc?path=${encodeURIComponent(path)}`;
}

if (import.meta.env.DEV) {
    // Manual test
    // eslint-disable-next-line no-console
    console.log('[webrtc] sample url:', buildWebRTCSignalingUrl('/demo/path'));
}
