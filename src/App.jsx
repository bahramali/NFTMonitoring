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
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminReports from './pages/AdminReports.jsx';
import AdminTeam from './pages/AdminTeam.jsx';
import WorkerDashboard from './pages/WorkerDashboard.jsx';
import MyPage from './pages/MyPage.jsx';

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
                        <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                            <SuperAdminDashboard />
                        </ProtectedRoute>
                    )}
                />
                <Route
                    path="/super-admin/admins"
                    element={(
                        <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                            <AdminManagement />
                        </ProtectedRoute>
                    )}
                />

                <Route
                    path="/admin/dashboard"
                    element={(
                        <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]} requiredPermission="admin-dashboard">
                            <AdminDashboard />
                        </ProtectedRoute>
                    )}
                />
                <Route
                    path="/dashboard/reports"
                    element={(
                        <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]} requiredPermission="admin-reports">
                            <AdminReports />
                        </ProtectedRoute>
                    )}
                />
                <Route
                    path="/admin/team"
                    element={(
                        <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]} requiredPermission="admin-team">
                            <AdminTeam />
                        </ProtectedRoute>
                    )}
                />

                <Route
                    path="/worker"
                    element={(
                        <ProtectedRoute allowedRoles={["SUPER_ADMIN", "WORKER"]}>
                            <WorkerDashboard />
                        </ProtectedRoute>
                    )}
                />

                <Route
                    path="/my-page"
                    element={(
                        <ProtectedRoute allowedRoles={["SUPER_ADMIN", "CUSTOMER"]}>
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
