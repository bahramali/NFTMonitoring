// no JSX here, so .js extension is fine
import React from 'react';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../src/context/AuthContext.jsx';

const defaultSession = {
    isAuthenticated: true,
    token: 'token',
    userId: 'admin-1',
    role: 'ADMIN',
    permissions: ['MONITORING_VIEW'],
    expiry: Date.now() + 60_000,
};

export function renderWithAuthSession(ui, options = {}) {
    const {
        session = {},
        wrapper,
        renderFn = render,
        ...renderOptions
    } = options;
    const resolvedSession = { ...defaultSession, ...session };

    window.localStorage.setItem('authSession', JSON.stringify(resolvedSession));

    const authNode = React.createElement(AuthProvider, { initialSession: resolvedSession }, ui);
    const wrappedNode = wrapper ? React.createElement(wrapper, null, authNode) : authNode;
    return renderFn(wrappedNode, renderOptions);
}
