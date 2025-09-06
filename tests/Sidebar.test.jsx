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
import Sidebar from '../src/pages/common/Sidebar';

test('renders Live link', () => {
    render(
        <MemoryRouter>
            <Sidebar />
        </MemoryRouter>
    );

    const liveLink = screen.getByRole('link', { name: /live/i });
    expect(liveLink).toBeInTheDocument();
    expect(liveLink).toHaveAttribute('href', '/live');
});

test('renders Note link', () => {
    render(
        <MemoryRouter>
            <Sidebar />
        </MemoryRouter>
    );

    const noteLink = screen.getByRole('link', { name: /note/i });
    expect(noteLink).toBeInTheDocument();
    expect(noteLink).toHaveAttribute('href', '/note');
});

