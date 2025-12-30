import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../src/context/AuthContext.jsx';

const mockLocation = { pathname: '/' };

vi.mock('react-router-dom', () => ({
    NavLink: ({ to, children, className }) => {
        const cls = typeof className === 'function' ? className({ isActive: false }) : className;
        return <a href={to} className={cls}>{children}</a>;
    },
    MemoryRouter: ({ children }) => <div>{children}</div>,
    useLocation: () => mockLocation,
}));

vi.mock('../src/pages/Reports/utils/catalog', () => ({
    fetchDeviceCatalog: vi.fn(() => Promise.resolve({ catalog: { devices: [] } })),
    normalizeDeviceCatalog: (value) => value,
    API_BASE: 'http://test',
}));

vi.mock('../src/api/topics.js', () => ({
    fetchTopicSensors: vi.fn(() => Promise.resolve({ topics: [], error: null })),
    API_BASE: 'http://test',
}));

import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../src/pages/common/Sidebar';
import { ReportsFiltersProvider } from '../src/pages/Reports/context/ReportsFiltersContext.jsx';

const renderSidebar = () => {
    window.localStorage.setItem(
        'authSession',
        JSON.stringify({
            isAuthenticated: true,
            token: 'token',
            userId: 'admin-1',
            role: 'ADMIN',
            permissions: ['MONITORING_VIEW'],
            expiry: Date.now() + 60_000,
        }),
    );

    return render(
        <MemoryRouter>
            <AuthProvider>
                <ReportsFiltersProvider>
                    <Sidebar />
                </ReportsFiltersProvider>
            </AuthProvider>
        </MemoryRouter>
    );
};

test('renders NFT Channels link', () => {
    mockLocation.pathname = '/';
    renderSidebar();

    const nftLink = screen.getByRole('link', { name: /nft channels/i });
    expect(nftLink).toBeInTheDocument();
    expect(nftLink).toHaveAttribute('href', '/monitoring/live');
});

test('renders Note link', () => {
    mockLocation.pathname = '/';
    renderSidebar();

    const noteLink = screen.getByRole('link', { name: /note/i });
    expect(noteLink).toBeInTheDocument();
    expect(noteLink).toHaveAttribute('href', '/monitoring/note');
});

test('does not render report filters in the sidebar on reports route', () => {
    mockLocation.pathname = '/monitoring/reports';
    renderSidebar();

    expect(screen.queryByText(/filters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/timing/i)).not.toBeInTheDocument();
});
