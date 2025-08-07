import React from 'react';
import { Outlet } from '../compat/react-router-dom.jsx';

function MainLayout() {
    return (
        <div>
            <Outlet />
        </div>
    );
}

export default MainLayout;
