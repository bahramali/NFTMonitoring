import { useEffect, useRef, useState } from 'react';

const RESET_COOLDOWN_MS = 8000;
const API_BASE =
    import.meta?.env?.VITE_API_BASE ||
    import.meta?.env?.VITE_API_URL ||
    'https://api.hydroleaf.se';

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
            const res = await fetch(`${API_BASE}/api/auth/password-reset`, {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) {
                let errorMessage = 'Could not start password reset. Please try again.';
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const body = await res.json().catch(() => null);
                    if (body?.message) {
                        errorMessage = body.message;
                    }
                }
                setResetState({ status: 'error', message: '' });
                setResetError(errorMessage);
                return;
            }
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
