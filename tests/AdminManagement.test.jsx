import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import AdminManagement from '../src/pages/AdminManagement.jsx';

function renderWithAuth(ui) {
    return render(<AuthProvider>{ui}</AuthProvider>);
}

describe('AdminManagement', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('sends an invite with the fallback sender email when none is configured', async () => {
        const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
        vi.stubGlobal('fetch', fetchMock);

        renderWithAuth(<AdminManagement />);

        expect(screen.queryByLabelText(/Username/i)).toBeNull();
        fireEvent.change(screen.getByLabelText(/Admin ID/i), { target: { value: 'admin-1' } });
        fireEvent.change(screen.getByLabelText(/Admin email/i), { target: { value: 'test@example.com' } });

        fireEvent.click(screen.getByRole('button', { name: /Create admin/i }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toContain('/api/admins/invite');
        expect(options.method).toBe('POST');
        const body = JSON.parse(options.body);
        expect(body.fromEmail).toBe('bahramali.az@gmail.com');
        expect(body.email).toBe('test@example.com');
        await screen.findByText(/Invitation email queued for test@example.com from bahramali.az@gmail.com/);
    });

    it('shows a manual notification when invites cannot be queued', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network unavailable'))));

        renderWithAuth(<AdminManagement />);

        expect(screen.queryByLabelText(/Username/i)).toBeNull();
        fireEvent.change(screen.getByLabelText(/Admin ID/i), { target: { value: 'admin-1' } });
        fireEvent.change(screen.getByLabelText(/Admin email/i), { target: { value: 'test@example.com' } });

        fireEvent.click(screen.getByRole('button', { name: /Create admin/i }));

        await screen.findByText(/Admin saved, but email delivery is unavailable/);
    });
});
