import { useState, useCallback } from 'react';
import { useStomp } from './useStomp';

/**
 * Subscribe to the `live_now` topic and expose the latest payload.
 */
export function useLiveNow() {
    const [status, setStatus] = useState(null);

    const handleMessage = useCallback((_topic, msg) => {
        setStatus(msg);
    }, []);

    useStomp('live_now', handleMessage);
    return status;
}
