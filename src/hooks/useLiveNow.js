// useLiveNow.js
import {useState, useCallback} from "react";
import {useStomp} from "./useStomp";

/** Latest payload from topic: live_now */
export function useLiveNow() {
    const [status, setStatus] = useState(null);
    const handle = useCallback((_topic, data) => {
        console.log('[live_now] message:', data);
        setStatus(data);
    }, []);
    useStomp("live_now", handle);
    return status;
}
