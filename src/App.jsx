import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import CustomerRoute from './components/CustomerRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NotAuthorized from './pages/NotAuthorized.jsx';
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx';
import AdminManagement from './pages/AdminManagement.jsx';
import AdminOverview from './pages/AdminOverview.jsx';
import AdminTeam from './pages/AdminTeam.jsx';
import AdminHome from './pages/AdminHome.jsx';
import WorkerDashboard from './pages/WorkerDashboard.jsx';
import CustomerLayout from './pages/customer/CustomerLayout.jsx';
import CustomerDashboard from './pages/customer/CustomerDashboard.jsx';
import CustomerOrders from './pages/customer/CustomerOrders.jsx';
import CustomerOrderDetails from './pages/customer/CustomerOrderDetails.jsx';
import CustomerAddresses from './pages/customer/CustomerAddresses.jsx';
import CustomerSettings from './pages/customer/CustomerSettings.jsx';
import CustomerSecurity from './pages/customer/CustomerSecurity.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import StorefrontLayout from './layouts/StorefrontLayout.jsx';
import Overview from './pages/Overview/index.jsx';
import ControlPanel from './pages/ControlPanel/index.jsx';
import LiveDashboard from './pages/Live/index.jsx';
import Germination from './pages/Germination/index.jsx';
import Cameras from './pages/Cameras/index.jsx';
import Reports from './pages/Reports/index.jsx';
import Note from './pages/Note/index.jsx';
import SensorConfig from './pages/SensorConfig/index.jsx';
import ShellyControlPage from './pages/ShellyControl/index.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import StoreLayout from './components/store/StoreLayout.jsx';
import Storefront from './pages/store/Storefront.jsx';
import ProductDetail from './pages/store/ProductDetail.jsx';
import CartPage from './pages/store/CartPage.jsx';
import Checkout from './pages/store/Checkout.jsx';
import OrderStatus from './pages/store/OrderStatus.jsx';
import ProductAdmin from './pages/ProductAdmin.jsx';
import CustomersList from './pages/store/CustomersList.jsx';
import CustomerDetails from './pages/store/CustomerDetails.jsx';
import Contact from './pages/store/Contact.jsx';
import Terms from './pages/store/Terms.jsx';
import Privacy from './pages/store/Privacy.jsx';
import PaymentSuccess from './pages/payment/PaymentSuccess.jsx';
import PaymentCancel from './pages/payment/PaymentCancel.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { SensorConfigProvider } from './context/SensorConfigContext.jsx';
import { PERMISSIONS, hasPerm } from './utils/permissions.js';

function ProtectedOutlet({ requiredRoles = [], requiredPermissions = [] }) {
    return (
        <ProtectedRoute requiredRoles={requiredRoles} requiredPermissions={requiredPermissions}>
            <Outlet />
        </ProtectedRoute>
    );
}

function AdminIndexRedirect() {
    const { role, roles, permissions } = useAuth();
    const availableRoles = roles?.length ? roles : role ? [role] : [];
    if (availableRoles.includes('SUPER_ADMIN')) {
        return <Navigate to="home" replace />;
    }
    if (hasPerm({ permissions }, PERMISSIONS.ADMIN_OVERVIEW_VIEW)) {
        return <Navigate to="overview" replace />;
    }
    return <Navigate to="/not-authorized" replace />;
}

function App() {
    const rawBase = import.meta?.env?.BASE_URL || '/';
    const base = rawBase === './' || rawBase === '/./' ? '/' : rawBase;

    return (
        <BrowserRouter basename={base}>
            <SensorConfigProvider>
                <Routes>
                <Route element={<PublicLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/payment/success" element={<PaymentSuccess />} />
                    <Route path="/payment/cancel" element={<PaymentCancel />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/not-authorized" element={<NotAuthorized />} />
                    <Route path="/invite/:token" element={<AcceptInvite />} />
                    <Route path="/auth/accept-invite" element={<AcceptInvite />} />
                    <Route path="/auth/accept-invite/:token" element={<AcceptInvite />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                </Route>

                <Route element={<StorefrontLayout />}>
                    <Route
                        path="/store"
                        element={<StoreLayout />}
                    >
                        <Route index element={<Storefront />} />
                        <Route path="product/:productId" element={<ProductDetail />} />
                        <Route path="cart" element={<CartPage />} />
                        <Route
                            path="checkout"
                            element={(
                                <ProtectedRoute>
                                    <Checkout />
                                </ProtectedRoute>
                            )}
                        />
                        <Route path="order/:orderId/success" element={<OrderStatus status="success" />} />
                        <Route path="order/:orderId/cancel" element={<OrderStatus status="cancel" />} />
                        <Route
                            path="admin/products"
                            element={(
                                <ProtectedRoute requiredPermissions={[PERMISSIONS.PRODUCTS_MANAGE]}>
                                    <ProductAdmin />
                                </ProtectedRoute>
                            )}
                        />
                        <Route
                            path="admin/customers"
                            element={(
                                <ProtectedRoute requiredPermissions={[PERMISSIONS.CUSTOMERS_VIEW]}>
                                    <CustomersList />
                                </ProtectedRoute>
                            )}
                        />
                        <Route
                            path="admin/customers/:customerId"
                            element={(
                                <ProtectedRoute requiredPermissions={[PERMISSIONS.CUSTOMERS_VIEW]}>
                                    <CustomerDetails />
                                </ProtectedRoute>
                            )}
                        />
                    </Route>

                    <Route path="/contact" element={<StoreLayout />}>
                        <Route index element={<Contact />} />
                    </Route>
                    <Route path="/terms" element={<StoreLayout />}>
                        <Route index element={<Terms />} />
                    </Route>
                    <Route path="/privacy" element={<StoreLayout />}>
                        <Route index element={<Privacy />} />
                    </Route>
                </Route>

                <Route element={<DashboardLayout />}>
                    <Route
                        path="/monitoring"
                        element={(
                            <ProtectedOutlet
                                requiredPermissions={[PERMISSIONS.MONITORING_VIEW]}
                            />
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
                                <ProtectedRoute requiredPermissions={[PERMISSIONS.MONITORING_VIEW]}>
                                    <Reports />
                                </ProtectedRoute>
                            )}
                        />
                        <Route path="note" element={<Note />} />
                        <Route path="sensor-config" element={<SensorConfig />} />
                    </Route>

                    <Route
                        path="/admin"
                        element={<ProtectedOutlet requiredPermissions={[PERMISSIONS.ADMIN_OVERVIEW_VIEW]} />}
                    >
                        <Route index element={<AdminIndexRedirect />} />
                        <Route
                            path="home"
                            element={(
                                <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                                    <AdminHome />
                                </ProtectedRoute>
                            )}
                        />
                        <Route
                            path="overview"
                            element={(
                                <ProtectedRoute requiredPermissions={[PERMISSIONS.ADMIN_OVERVIEW_VIEW]}>
                                    <AdminOverview />
                                </ProtectedRoute>
                            )}
                        />
                        <Route
                            path="team"
                            element={(
                                <ProtectedRoute requiredPermissions={[PERMISSIONS.ADMIN_PERMISSIONS_MANAGE]}>
                                    <AdminTeam />
                                </ProtectedRoute>
                            )}
                        />
                        <Route
                            path="tools"
                            element={(
                                <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                                    <SuperAdminDashboard />
                                </ProtectedRoute>
                            )}
                        />
                        <Route
                            path="directory"
                            element={(
                                <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                                    <AdminManagement />
                                </ProtectedRoute>
                            )}
                        />
                    </Route>
                    <Route
                        path="/worker/dashboard"
                        element={(
                            <ProtectedRoute requiredPermissions={[PERMISSIONS.MONITORING_VIEW]}>
                                <WorkerDashboard />
                            </ProtectedRoute>
                        )}
                    />
                </Route>

                <Route
                    path="/my-page/*"
                    element={(
                        <CustomerRoute>
                            <CustomerLayout />
                        </CustomerRoute>
                    )}
                >
                    <Route index element={<CustomerDashboard />} />
                    <Route path="orders" element={<CustomerOrders />} />
                    <Route path="orders/:orderId" element={<CustomerOrderDetails />} />
                    <Route path="addresses" element={<CustomerAddresses />} />
                    <Route path="settings" element={<CustomerSettings />} />
                    <Route path="security" element={<CustomerSecurity />} />
                </Route>

                <Route path="/dashboard/*" element={<Navigate to="/monitoring/overview" replace />} />
                <Route path="/monitoring/admin/products" element={<Navigate to="/store/admin/products" replace />} />
                <Route path="/admin/dashboard" element={<Navigate to="/admin/overview" replace />} />
                <Route path="/team" element={<Navigate to="/admin/team" replace />} />
                <Route path="/super-admin" element={<Navigate to="/admin/home" replace />} />
                <Route path="/super-admin/admins" element={<Navigate to="/admin/directory" replace />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </SensorConfigProvider>
        </BrowserRouter>
    );
}

export default App;
