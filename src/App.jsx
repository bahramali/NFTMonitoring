import React from 'react';
import { BrowserRouter as Router, Routes, Route } from './compat/react-router-dom.jsx';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import UserInfo from './pages/UserInfo';
import Documentation from './pages/Documentation';
import Device from './pages/filters/Device';
import Layer from './pages/filters/Layer';
import System from './pages/filters/System';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="user" element={<UserInfo />} />
                    <Route path="docs" element={<Documentation />} />
                    <Route path="filters/device" element={<Device />} />
                    <Route path="filters/layer" element={<Layer />} />
                    <Route path="filters/system" element={<System />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
