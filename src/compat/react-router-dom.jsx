import React from 'react';

export function BrowserRouter({ children }) {
    return <div>{children}</div>;
}

export function Routes({ children }) {
    return <div>{children}</div>;
}

export function Route({ element }) {
    return <>{element}</>;
}

export function Outlet() {
    return null;
}

export function Sidebar() {
    return null;
}

export function NavLink({ to, children, className }) {
    const cls =
        typeof className === 'function' ? className({ isActive: false }) : className;
    return (
        <a href={to} className={cls}>
            {children}
        </a>
    );
}

