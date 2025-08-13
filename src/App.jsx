import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardPage  from './pages/DashboardPage';
import Live from './pages/Live';
import ReportsPage from './pages/ReportsPage';
import Settings from './pages/Settings';
import UserInfo from './pages/UserInfo';
import Documentation from './pages/Documentation';
import Device from './pages/filters/Device';
import Layer from './pages/filters/Layer';
import System from './pages/filters/System';

function App() {
    const rawBase = import.meta?.env?.BASE_URL || '/';
    const base = rawBase === './' || rawBase === '/./' ? '/' : rawBase;

    return (
        <BrowserRouter basename={base}>
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<DashboardPage />} />
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
