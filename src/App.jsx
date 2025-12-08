import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Overview from './pages/Overview';
import Live from './pages/Live';
import Cameras from './pages/Cameras';
import Germination from './pages/Germination';
import Reports from './pages/Reports';
import UserInfo from './pages/UserInfo';
import SensorConfig from './pages/SensorConfig';
import Note from './pages/Note';
import ControlPanel from './pages/ControlPanel';
import Login from './pages/Login.jsx';
import { useAuth } from './context/AuthContext.jsx';

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

function App() {
    const rawBase = import.meta?.env?.BASE_URL || '/';
    const base = rawBase === './' || rawBase === '/./' ? '/' : rawBase;
    const { isAuthenticated } = useAuth();

    return (
        <BrowserRouter basename={base}>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/"
                    element={(
                        <ProtectedRoute>
                            <MainLayout />
                        </ProtectedRoute>
                    )}
                >
                    <Route index element={<Navigate to="/overview" replace />} />
                    <Route path="overview" element={<Overview />} />
                    <Route path="live" element={<Live />} />
                    <Route path="germination" element={<Germination />} />
                    <Route path="cameras" element={<Cameras />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="note" element={<Note />} />
                    <Route path="user" element={<UserInfo />} />
                    <Route path="sensor-config" element={<SensorConfig />} />
                    <Route path="control-panel" element={<ControlPanel />} />
                </Route>
                <Route
                    path="*"
                    element={<Navigate to={isAuthenticated ? '/overview' : '/login'} replace />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
