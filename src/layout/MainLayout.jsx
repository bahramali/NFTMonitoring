import React from 'react';
import { Sidebar, Outlet } from 'react-router-dom';

export default function MainLayout() {
    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ flexGrow: 1 }}>
                <Outlet />
            </main>
        </div>
    );
}
