import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('react-router-dom', () => ({
    NavLink: ({ to, children, className }) => {
        const cls = typeof className === 'function' ? className({ isActive: false }) : className;
        return <a href={to} className={cls}>{children}</a>;
    },
    MemoryRouter: ({ children }) => <div>{children}</div>,
}));

import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../src/components/Sidebar';
import { FiltersProvider } from '../src/features/dashboard/FiltersContext';

test('renders Live link', () => {
    render(
        <FiltersProvider>
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>
        </FiltersProvider>
    );

    const liveLink = screen.getByRole('link', { name: /live/i });
    expect(liveLink).toBeInTheDocument();
    expect(liveLink).toHaveAttribute('href', '/live');
});

