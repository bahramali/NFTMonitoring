/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCustomerProfile, updateCustomerProfile } from '../api/customer.js';
import { fetchStoreConfig } from '../api/store.js';
import { useAuth } from './AuthContext.jsx';
import {
    hasBusinessProfile,
    normalizeVatRateDecimal,
    resolvePriceDisplayMode,
} from '../utils/storePricingDisplay.js';

const STORAGE_KEY = 'storePricingDisplay';

const defaultState = {
    customerType: 'B2C',
    priceDisplayMode: 'INCL_MOMS',
    vatRate: 0.25,
    companyProfile: {
        companyName: '',
        orgNumber: '',
        vatNumber: '',
        invoiceEmail: '',
    },
};

const PricingDisplayContext = createContext({
    ...defaultState,
    setCustomerType: () => {},
    setCompanyProfile: () => {},
    setVatRate: () => {},
});

const readStoredState = () => {
    if (typeof window === 'undefined') return defaultState;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    try {
        const parsed = JSON.parse(raw);
        const customerType = parsed?.customerType === 'B2B' ? 'B2B' : 'B2C';
        return {
            customerType,
            priceDisplayMode: resolvePriceDisplayMode(customerType),
            vatRate: normalizeVatRateDecimal(parsed?.vatRate, defaultState.vatRate),
            companyProfile: {
                ...defaultState.companyProfile,
                ...(parsed?.companyProfile ?? {}),
            },
        };
    } catch {
        return defaultState;
    }
};

const persistState = (state) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const normalizeMeProfile = (payload) => {
    const source = payload?.user ?? payload ?? {};
    const company = source?.company ?? source?.business ?? source?.organization ?? {};
    const isB2B = hasBusinessProfile(source) || hasBusinessProfile(source?.raw);
    return {
        customerType: isB2B ? 'B2B' : 'B2C',
        companyProfile: {
            companyName: source?.companyName ?? company?.name ?? '',
            orgNumber: source?.orgNumber ?? source?.organizationNumber ?? company?.orgNumber ?? '',
            vatNumber: source?.vatNumber ?? company?.vatNumber ?? '',
            invoiceEmail: source?.invoiceEmail ?? company?.invoiceEmail ?? source?.email ?? '',
        },
    };
};

export function PricingDisplayProvider({ children }) {
    const { isAuthenticated, token, profile } = useAuth();
    const [state, setState] = useState(() => readStoredState());

    useEffect(() => {
        persistState(state);
    }, [state]);

    useEffect(() => {
        const controller = new AbortController();
        fetchStoreConfig({ signal: controller.signal })
            .then((configPayload) => {
                const config = configPayload?.config ?? configPayload ?? {};
                const resolvedVatRate = normalizeVatRateDecimal(config?.defaultVatRate ?? config?.vatRate, defaultState.vatRate);
                setState((prev) => ({ ...prev, vatRate: resolvedVatRate }));
            })
            .catch(() => {});
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !token) return;
        const controller = new AbortController();
        fetchCustomerProfile(token, { signal: controller.signal })
            .then((payload) => {
                if (!payload) return;
                const normalized = normalizeMeProfile(payload);
                setState((prev) => {
                    const customerType = normalized.customerType;
                    return {
                        ...prev,
                        customerType,
                        priceDisplayMode: resolvePriceDisplayMode(customerType),
                        companyProfile: {
                            ...prev.companyProfile,
                            ...normalized.companyProfile,
                        },
                    };
                });
            })
            .catch(() => {});

        return () => controller.abort();
    }, [isAuthenticated, token]);

    useEffect(() => {
        if (!isAuthenticated) {
            if (hasBusinessProfile(profile)) {
                setState((prev) => ({
                    ...prev,
                    customerType: 'B2B',
                    priceDisplayMode: 'EXKL_MOMS',
                }));
            }
            return;
        }

        if (hasBusinessProfile(profile)) {
            setState((prev) => ({
                ...prev,
                customerType: 'B2B',
                priceDisplayMode: 'EXKL_MOMS',
            }));
        }
    }, [isAuthenticated, profile]);

    const setCustomerType = useCallback(async (customerType, { persistProfile = false, companyProfile } = {}) => {
        const normalizedType = customerType === 'B2B' ? 'B2B' : 'B2C';
        const priceDisplayMode = resolvePriceDisplayMode(normalizedType);

        setState((prev) => ({
            ...prev,
            customerType: normalizedType,
            priceDisplayMode,
            companyProfile: companyProfile ? { ...prev.companyProfile, ...companyProfile } : prev.companyProfile,
        }));

        if (!persistProfile || !isAuthenticated || !token) return;
        try {
            await updateCustomerProfile(token, {
                customerType: normalizedType,
                priceDisplayMode,
                ...(companyProfile ? companyProfile : {}),
            });
        } catch {
            // ignore endpoint availability errors; local state remains persisted.
        }
    }, [isAuthenticated, token]);

    const setCompanyProfile = useCallback(async (companyProfile, { persistProfile = false } = {}) => {
        setState((prev) => ({
            ...prev,
            companyProfile: {
                ...prev.companyProfile,
                ...companyProfile,
            },
        }));

        if (!persistProfile || !isAuthenticated || !token) return;

        try {
            await updateCustomerProfile(token, companyProfile);
        } catch {
            // ignore endpoint availability errors; local state remains persisted.
        }
    }, [isAuthenticated, token]);

    const setVatRate = useCallback((vatRate) => {
        setState((prev) => ({ ...prev, vatRate: normalizeVatRateDecimal(vatRate, prev.vatRate) }));
    }, []);

    const value = useMemo(() => ({
        ...state,
        setCustomerType,
        setCompanyProfile,
        setVatRate,
    }), [setCompanyProfile, setCustomerType, setVatRate, state]);

    return <PricingDisplayContext.Provider value={value}>{children}</PricingDisplayContext.Provider>;
}

export const usePricingDisplay = () => useContext(PricingDisplayContext);
