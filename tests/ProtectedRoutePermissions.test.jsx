import React from 'react';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import ProtectedRoute from '../src/components/ProtectedRoute.jsx';
import { PERMISSIONS } from '../src/utils/permissions.js';
import { renderWithAuthSession } from './utils/renderWithAuthSession';

const renderWithAuth = (permissions, initialPath = '/store/admin/products') => {
    const RouterWrapper = ({ children }) => (
        <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    );

    return renderWithAuthSession(
        <Routes>
            <Route
                path="/store/admin/products"
                element={(
                    <ProtectedRoute requiredPermissions={[PERMISSIONS.PRODUCTS_MANAGE]}>
                        <div>Products Admin</div>
                    </ProtectedRoute>
                )}
            />
            <Route path="/not-authorized" element={<div>Not Authorized</div>} />
        </Routes>,
        {
            session: {
                permissions,
            },
            wrapper: RouterWrapper,
        },
    );
};

test('allows access when permission is present', () => {
    renderWithAuth([PERMISSIONS.PRODUCTS_MANAGE]);
    expect(screen.getByText('Products Admin')).toBeInTheDocument();
});

test('redirects to not authorized when permission is missing', () => {
    renderWithAuth([PERMISSIONS.CUSTOMERS_VIEW]);
    expect(screen.getByText('Not Authorized')).toBeInTheDocument();
});
