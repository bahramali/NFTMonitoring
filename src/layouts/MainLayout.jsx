import React from 'react';
import { Outlet } from '../compat/react-router-dom.jsx';
import Sidebar from '../components/Sidebar.jsx';

function MainLayout() {
    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{ flexGrow: 1 }}>
                <Outlet />
            </main>
        </div>
    );
}

export default MainLayout;
