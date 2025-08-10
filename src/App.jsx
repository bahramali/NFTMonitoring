import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Outlet } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Live from './pages/Live';
import ReportsPage from './pages/ReportsPage';
import Settings from './pages/Settings';
import UserInfo from './pages/UserInfo';
import Documentation from './pages/Documentation';
import Device from './pages/filters/Device';
import Layer from './pages/filters/Layer';
import System from './pages/filters/System';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="live" element={<Live />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="user" element={<UserInfo />} />
                    <Route path="docs" element={<Documentation />} />
                    <Route path="filters/device" element={<Device />} />
                    <Route path="filters/layer" element={<Layer />} />
                    <Route path="filters/system" element={<System />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
