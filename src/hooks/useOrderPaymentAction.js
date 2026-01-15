import { useCallback, useState } from 'react';
import { createOrderPaymentSession } from '../api/customer.js';
import { useAuth } from '../context/AuthContext.jsx';
import useRedirectToLogin from './useRedirectToLogin.js';
import { extractPaymentUrl, resolveOrderPaymentUrl } from '../utils/payment.js';

const resolveSessionPaymentUrl = (payload) =>
    extractPaymentUrl(payload)
    ?? extractPaymentUrl(payload?.checkout)
    ?? extractPaymentUrl(payload?.session)
    ?? null;

export default function useOrderPaymentAction() {
    const { token } = useAuth();
    const redirectToLogin = useRedirectToLogin();
    const [state, setState] = useState({ loadingId: null, error: null });

    const handleOrderPayment = useCallback(
        async (order) => {
            if (!order) return;
            if (!token) {
                redirectToLogin();
                return;
            }

            const directUrl = resolveOrderPaymentUrl(order);
            if (directUrl) {
                window.location.assign(directUrl);
                return;
            }

            setState({ loadingId: order.id, error: null });
            try {
                const payload = await createOrderPaymentSession(token, order.id, {
                    onUnauthorized: redirectToLogin,
                });
                if (payload === null) return;
                const paymentUrl = resolveSessionPaymentUrl(payload);
                if (!paymentUrl) {
                    throw new Error('Payment link unavailable. Please contact support.');
                }
                window.location.assign(paymentUrl);
            } catch (error) {
                if (error?.name === 'AbortError') return;
                setState({ loadingId: null, error: error?.message || 'Failed to continue payment.' });
                return;
            } finally {
                setState((prev) => ({ ...prev, loadingId: null }));
            }
        },
        [redirectToLogin, token],
    );

    const resetError = useCallback(() => {
        setState((prev) => ({ ...prev, error: null }));
    }, []);

    return {
        error: state.error,
        loadingId: state.loadingId,
        handleOrderPayment,
        resetError,
    };
}
