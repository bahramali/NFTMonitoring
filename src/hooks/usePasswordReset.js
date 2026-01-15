import { useEffect, useRef, useState } from 'react';
import { requestPasswordReset } from '../api/auth.js';

const RESET_COOLDOWN_MS = 8000;

export default function usePasswordReset({ token } = {}) {
    const [resetState, setResetState] = useState({ status: 'idle', message: '' });
    const [resetError, setResetError] = useState('');
    const [resetCooldown, setResetCooldown] = useState(false);
    const resetTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (resetTimerRef.current) {
                window.clearTimeout(resetTimerRef.current);
            }
        };
    }, []);

    const handlePasswordReset = async () => {
        if (resetState.status === 'sending' || resetCooldown) return;
        setResetState({ status: 'sending', message: '' });
        setResetError('');
        try {
            await requestPasswordReset({ token });
            setResetState({ status: 'sent', message: 'Reset link sent to your email' });
            setResetCooldown(true);
            resetTimerRef.current = window.setTimeout(() => {
                setResetCooldown(false);
            }, RESET_COOLDOWN_MS);
        } catch (error) {
            setResetState({ status: 'error', message: '' });
            setResetError(error?.message || 'Unable to send reset link.');
        }
    };

    const resetDisabled = resetState.status === 'sending' || resetCooldown;

    return {
        resetState,
        resetError,
        resetCooldown,
        resetDisabled,
        handlePasswordReset,
    };
}
