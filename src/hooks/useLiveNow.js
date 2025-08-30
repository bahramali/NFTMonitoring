// useLiveNow.js
import {useState, useCallback} from "react";
import {useStomp} from "./useStomp";

/** Latest payload from topic: live_now */
export function useLiveNow() {
    const [status, setStatus] = useState(null);

    const normalize = (payload) => {
        const out = {};
        const fixSubs = (s) => String(s).replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => "0123456789"["₀₁₂₃₄₅₆₇₈₉".indexOf(d)]);
        for (const [k, v] of Object.entries(payload || {})) {
            const key = fixSubs(k).replace(/[\s_-]/g, "").toLowerCase();
            out[key] = v;
        }
        return out;
    };

    const handle = useCallback((_topic, data) => {
        console.log('[live_now] message:', data);
        setStatus(normalize(data));
    }, []);

    useStomp("live_now", handle);
    return status;
}
