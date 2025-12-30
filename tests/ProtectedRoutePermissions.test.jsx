import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import ProtectedRoute from '../src/components/ProtectedRoute.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { PERMISSIONS } from '../src/utils/permissions.js';

const renderWithAuth = (permissions, initialPath = '/store/admin/products') => {
    window.localStorage.setItem(
        'authSession',
        JSON.stringify({
            isAuthenticated: true,
            token: 'token',
            userId: 'admin-1',
            role: 'ADMIN',
            permissions,
            expiry: Date.now() + 60_000,
        }),
    );

    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <AuthProvider>
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
                </Routes>
            </AuthProvider>
        </MemoryRouter>,
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
