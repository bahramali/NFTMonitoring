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
        const fetchMock = vi.fn((url, options = {}) => {
            if (url.includes('/permissions')) {
                return Promise.resolve(
                    createJsonResponse({
                        available: [
                            {
                                code: 'ADMIN_OVERVIEW_VIEW',
                                label: 'Admin Overview',
                                description: 'Overview access',
                                group: 'Admin',
                                defaultSelected: true,
                            },
                            {
                                code: 'MONITORING_VIEW',
                                label: 'Monitoring',
                                description: 'Monitoring access',
                                group: 'Monitoring',
                                defaultSelected: false,
                            },
                        ],
                        presets: { ADMIN_STANDARD: ['ADMIN_OVERVIEW_VIEW'] },
                    }),
                );
            }

            if (options?.method === 'POST' && url.includes('/invite')) {
                return Promise.resolve(createJsonResponse({ id: 'admin-1', status: 'INVITED' }));
            }

            return Promise.resolve(createJsonResponse({ admins: [] }));
        });
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

        await screen.findByLabelText(/Admin Overview/i);
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
        expect(body.permissions).toEqual(['ADMIN_OVERVIEW_VIEW']);
        expect(options.headers.Authorization).toBe('Bearer token-123');
        await screen.findByText(/Invite sent successfully/i);
    });

    it('shows a manual notification when invites cannot be queued', async () => {
        const fetchMock = vi.fn((url, options = {}) => {
            if (url.includes('/permissions')) {
                return Promise.resolve(
                    createJsonResponse({
                        available: [
                            {
                                code: 'ADMIN_OVERVIEW_VIEW',
                                label: 'Admin Overview',
                                description: '',
                                group: 'Admin',
                                defaultSelected: true,
                            },
                        ],
                        presets: { ADMIN_STANDARD: ['ADMIN_OVERVIEW_VIEW'] },
                    }),
                );
            }

            if (options?.method === 'POST' && url.includes('/invite')) {
                return Promise.reject(new Error('Network unavailable'));
            }

            return Promise.resolve(createJsonResponse({ admins: [] }));
        });
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

        await screen.findByLabelText(/Admin Overview/i);
        expect(screen.queryByLabelText(/Username/i)).toBeNull();
        fireEvent.change(screen.getByLabelText(/Admin email/i), { target: { value: 'test@example.com' } });

        fireEvent.click(screen.getByRole('button', { name: /Send invite/i }));

        await screen.findByText(/Network unavailable/);
    });

    it('renders new permissions returned by the backend definitions', async () => {
        const fetchMock = vi.fn((url) => {
            if (url.includes('/permissions')) {
                return Promise.resolve(
                    createJsonResponse({
                        available: [
                            { code: 'ADMIN_OVERVIEW_VIEW', label: 'Admin Overview', group: 'Admin', defaultSelected: true },
                            {
                                code: 'ADMIN_PERMISSIONS_MANAGE',
                                label: 'Admin Management',
                                description: 'Manage admin permissions',
                                group: 'Admin',
                                defaultSelected: false,
                            },
                            {
                                code: 'MONITORING_INSIGHTS',
                                label: 'Insights',
                                description: 'Newly added permission',
                                group: 'Monitoring',
                                defaultSelected: false,
                            },
                        ],
                        presets: { ADMIN_STANDARD: ['ADMIN_OVERVIEW_VIEW'] },
                    }),
                );
            }

            return Promise.resolve(createJsonResponse({ admins: [] }));
        });
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

        await screen.findByLabelText(/Admin Overview/i);
        const newPermissionCheckbox = await screen.findByLabelText(/Insights/i);
        expect(newPermissionCheckbox).toBeInTheDocument();
    });
});
