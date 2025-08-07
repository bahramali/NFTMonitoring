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
