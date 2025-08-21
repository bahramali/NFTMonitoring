import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './features/dashboard/pages/DashboardPage';
import Live from './features/dashboard/pages/Live';
import ReportsPage from './features/reports/pages/ReportsPage';
import Settings from './pages/Settings';
import UserInfo from './pages/UserInfo';
import Documentation from './pages/Documentation';

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
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
