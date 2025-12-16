import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NotAuthorized from './pages/NotAuthorized.jsx';
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx';
import AdminManagement from './pages/AdminManagement.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import AdminTeam from './pages/AdminTeam.jsx';
import WorkerDashboard from './pages/WorkerDashboard.jsx';
import MyPage from './pages/MyPage.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import Overview from './pages/Overview/index.jsx';
import ControlPanel from './pages/ControlPanel/index.jsx';
import LiveDashboard from './pages/Live/index.jsx';
import Germination from './pages/Germination/index.jsx';
import Cameras from './pages/Cameras/index.jsx';
import Reports from './pages/Reports/index.jsx';
import Note from './pages/Note/index.jsx';
import SensorConfig from './pages/SensorConfig/index.jsx';
import ShellyControlPage from './pages/ShellyControl/index.jsx';

function App() {
    const rawBase = import.meta?.env?.BASE_URL || '/';
    const base = rawBase === './' || rawBase === '/./' ? '/' : rawBase;

    return (
        <BrowserRouter basename={base}>
            <Navbar />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/not-authorized" element={<NotAuthorized />} />

                <Route
                    path="/super-admin"
                    element={(
                        <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                            <SuperAdminDashboard />
                        </ProtectedRoute>
                    )}
                />
                <Route
                    path="/super-admin/admins"
                    element={(
                        <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                            <AdminManagement />
                        </ProtectedRoute>
                    )}
                />

                <Route
                    path="/admin"
                    element={(
                        <ProtectedRoute requiredRoles={["SUPER_ADMIN", "ADMIN"]} requiredPermissions={["ADMIN_DASHBOARD"]}>
                            <AdminOverview />
                        </ProtectedRoute>
                    )}
                />
                <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
                <Route
                    path="/admin/team"
                    element={(
                        <ProtectedRoute requiredRoles={["SUPER_ADMIN", "ADMIN"]} requiredPermissions={["ADMIN_TEAM"]}>
                            <AdminTeam />
                        </ProtectedRoute>
                    )}
                />

                <Route
                    path="/team"
                    element={(
                        <ProtectedRoute requiredRoles={["SUPER_ADMIN", "ADMIN"]} requiredPermissions={["ADMIN_TEAM"]}>
                            <AdminTeam />
                        </ProtectedRoute>
                    )}
                />

                <Route
                    path="/dashboard/*"
                    element={(
                        <ProtectedRoute
                            requiredRoles={["SUPER_ADMIN", "ADMIN", "WORKER"]}
                            requiredPermissions={["ADMIN_DASHBOARD"]}
                        >
                            <MainLayout />
                        </ProtectedRoute>
                    )}
                >
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<Overview />} />
                    <Route path="control-panel" element={<ControlPanel />} />
                    <Route path="shelly-control" element={<ShellyControlPage />} />
                    <Route path="live" element={<LiveDashboard />} />
                    <Route path="germination" element={<Germination />} />
                    <Route path="cameras" element={<Cameras />} />
                    <Route
                        path="reports"
                        element={(
                            <ProtectedRoute requiredRoles={["SUPER_ADMIN", "ADMIN"]} requiredPermissions={["ADMIN_REPORTS"]}>
                                <Reports />
                            </ProtectedRoute>
                        )}
                    />
                    <Route path="note" element={<Note />} />
                    <Route path="sensor-config" element={<SensorConfig />} />
                </Route>

                <Route
                    path="/worker/dashboard"
                    element={(
                        <ProtectedRoute requiredRoles={["SUPER_ADMIN", "WORKER"]}>
                            <WorkerDashboard />
                        </ProtectedRoute>
                    )}
                />

                <Route
                    path="/my-page"
                    element={(
                        <ProtectedRoute requiredRoles={["SUPER_ADMIN", "CUSTOMER"]}>
                            <MyPage />
                        </ProtectedRoute>
                    )}
                />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
