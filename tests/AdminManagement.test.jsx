import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import AdminManagement from '../src/pages/AdminManagement.jsx';

const createJsonResponse = (body, ok = true, status = 200) => ({
    ok,
    status,
    text: () => Promise.resolve(body ? JSON.stringify(body) : ''),
});

function renderWithAuth(ui) {
    return render(<AuthProvider>{ui}</AuthProvider>);
}

describe('AdminManagement', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        window.localStorage.clear();
    });

    it('sends an invite with the fallback sender email when none is configured', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                createJsonResponse({
                    permissions: [
                        { key: 'ADMIN_DASHBOARD', label: 'Admin Overview', defaultSelected: true },
                        { key: 'ADMIN_REPORTS', label: 'Reports' },
                    ],
                }),
            )
            .mockResolvedValueOnce(createJsonResponse({ admins: [] }))
            .mockResolvedValueOnce(createJsonResponse({ id: 'admin-1', status: 'INVITED' }))
            .mockResolvedValueOnce(createJsonResponse({ admins: [] }));
        vi.stubGlobal('fetch', fetchMock);

        window.localStorage.setItem(
            'authSession',
            JSON.stringify({
                isAuthenticated: true,
                token: 'token-123',
                userId: 'super-admin',
                role: 'SUPER_ADMIN',
                permissions: [],
                expiry: Date.now() + 60_000,
            }),
        );

        renderWithAuth(<AdminManagement />);

        await screen.findByText(/Admin Overview/i);
        expect(screen.queryByLabelText(/Username/i)).toBeNull();
        fireEvent.change(screen.getByLabelText(/Admin email/i), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByLabelText(/Display name/i), { target: { value: 'Test Admin' } });

        fireEvent.click(screen.getByRole('button', { name: /Send invite/i }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());

        const inviteCall = fetchMock.mock.calls.find(([requestUrl]) => requestUrl.includes('/invite'));
        expect(inviteCall).toBeDefined();
        const [url, options] = inviteCall;
        expect(url).toContain('/api/super-admin/admins');
        expect(options.method).toBe('POST');
        const body = JSON.parse(options.body);
        expect(body.email).toBe('test@example.com');
        expect(body.displayName).toBe('Test Admin');
        expect(body.permissions).toContain('ADMIN_DASHBOARD');
        expect(options.headers.Authorization).toBe('Bearer token-123');
        await screen.findByText(/Invite sent successfully/i);
    });

    it('shows a manual notification when invites cannot be queued', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(
                    createJsonResponse({
                        permissions: [{ key: 'ADMIN_DASHBOARD', label: 'Admin Overview', defaultSelected: true }],
                    }),
                )
                .mockResolvedValueOnce(createJsonResponse({ admins: [] }))
                .mockRejectedValueOnce(new Error('Network unavailable')),
        );

        window.localStorage.setItem(
            'authSession',
            JSON.stringify({
                isAuthenticated: true,
                token: 'token-123',
                userId: 'super-admin',
                role: 'SUPER_ADMIN',
                permissions: [],
                expiry: Date.now() + 60_000,
            }),
        );

        renderWithAuth(<AdminManagement />);

        await screen.findByText(/Admin Overview/i);
        expect(screen.queryByLabelText(/Username/i)).toBeNull();
        fireEvent.change(screen.getByLabelText(/Admin email/i), { target: { value: 'test@example.com' } });

        fireEvent.click(screen.getByRole('button', { name: /Send invite/i }));

        await screen.findByText(/Network unavailable/);
    });

    it('renders permissions returned by the backend without code changes', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(
                    createJsonResponse({
                        permissions: [
                            { key: 'ADMIN_DASHBOARD', label: 'Admin Overview' },
                            { key: 'NEW_PERMISSION', label: 'New Permission', description: 'Synced from backend' },
                        ],
                    }),
                )
                .mockResolvedValueOnce(
                    createJsonResponse({
                        admins: [
                            {
                                id: 'admin-1',
                                email: 'new@example.com',
                                permissions: ['NEW_PERMISSION'],
                                status: 'ACTIVE',
                            },
                        ],
                    }),
                ),
        );

        window.localStorage.setItem(
            'authSession',
            JSON.stringify({
                isAuthenticated: true,
                token: 'token-123',
                userId: 'super-admin',
                role: 'SUPER_ADMIN',
                permissions: [],
                expiry: Date.now() + 60_000,
            }),
        );

        renderWithAuth(<AdminManagement />);

        const newPermissionLabels = await screen.findAllByText(/New Permission/i);
        expect(newPermissionLabels.length).toBeGreaterThan(0);
    });
});
