import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Overview from './pages/Overview';
import Live from './pages/Live';
import Cameras from './pages/Cameras';
import Reports from './pages/Reports';
import UserInfo from './pages/UserInfo';
import SensorConfig from './pages/SensorConfig';
import Note from './pages/Note';

function App() {
    const rawBase = import.meta?.env?.BASE_URL || '/';
    const base = rawBase === './' || rawBase === '/./' ? '/' : rawBase;

    return (
        <BrowserRouter basename={base}>
            <Routes>
                <Route path="/" element={<MainLayout />}> 
                    <Route index element={<Navigate to="/overview" replace />} />
                    <Route path="overview" element={<Overview />} />
                    <Route path="live" element={<Live />} />
                    <Route path="cameras" element={<Cameras />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="note" element={<Note />} />
                    <Route path="user" element={<UserInfo />} />
                    <Route path="sensor-config" element={<SensorConfig />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
