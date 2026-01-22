import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import HallPage from './pages/Hall/HallPage.jsx';
import HallRackPage from './pages/Hall/HallRackPage.jsx';
import HallLayerPage from './pages/Hall/HallLayerPage.jsx';
import Cameras from './pages/Cameras/index.jsx';
import Reports from './pages/Reports/index.jsx';
import Note from './pages/Note/index.jsx';
import SensorConfig from './pages/SensorConfig/index.jsx';
import ShellyControlPage from './pages/ShellyControl/index.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import StoreLayout from './components/store/StoreLayout.jsx';
import Storefront from './pages/store/Storefront.jsx';
import ProductDetail from './pages/store/ProductDetail.jsx';
import CartPage from './pages/store/CartPage.jsx';
import Checkout from './pages/store/Checkout.jsx';
import CheckoutCancel from './pages/store/CheckoutCancel.jsx';
import CheckoutSuccess from './pages/store/CheckoutSuccess.jsx';
import ProductAdmin from './pages/ProductAdmin.jsx';
import CustomersList from './pages/store/CustomersList.jsx';
import CustomerDetails from './pages/store/CustomerDetails.jsx';
import Contact from './pages/store/Contact.jsx';
import About from './pages/store/About.jsx';
import FAQ from './pages/store/FAQ.jsx';
import ShippingReturns from './pages/store/ShippingReturns.jsx';
import Terms from './pages/store/Terms.jsx';
import Privacy from './pages/store/Privacy.jsx';
import TimelapsePage from './pages/Timelapse/index.jsx';
import PaymentSuccess from './pages/payment/PaymentSuccess.jsx';
import PaymentCancel from './pages/payment/PaymentCancel.jsx';
import WebRTCConnectivityTest from './pages/WebRTCConnectivityTest.jsx';
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

function LegacyAccountRedirect() {
    const location = useLocation();
    const nextPath = location.pathname.replace(/^\/my-page/, '/account');
    return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />;
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
            <AppRoutes />
        </BrowserRouter>
    );
}

function AppRoutes() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const redirectPath = sessionStorage.getItem('redirect');
        if (!redirectPath) return;
        sessionStorage.removeItem('redirect');
        const currentPath = `${location.pathname}${location.search}${location.hash}`;
        if (redirectPath !== currentPath) {
            navigate(redirectPath, { replace: true });
        }
    }, [location.hash, location.pathname, location.search, navigate]);

    return (
        <SensorConfigProvider locationPath={location.pathname}>
            <Routes>
                <Route element={<PublicLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/timelapse" element={<TimelapsePage />} />
                    <Route path="/webrtc-test" element={<WebRTCConnectivityTest />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/not-authorized" element={<NotAuthorized />} />
                    <Route path="/invite/:token" element={<AcceptInvite />} />
                    <Route path="/auth/accept-invite" element={<AcceptInvite />} />
                    <Route path="/auth/accept-invite/:token" element={<AcceptInvite />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
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
                        <Route path="checkout" element={<Checkout />} />
                        <Route path="checkout/success" element={<CheckoutSuccess />} />
                        <Route path="checkout/cancel" element={<CheckoutCancel />} />
                        <Route path="order/:orderId/success" element={<PaymentSuccess />} />
                        <Route path="order/:orderId/cancel" element={<PaymentCancel />} />
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
                    <Route path="/about" element={<StoreLayout />}>
                        <Route index element={<About />} />
                    </Route>
                    <Route path="/faq" element={<StoreLayout />}>
                        <Route index element={<FAQ />} />
                    </Route>
                    <Route path="/shipping-returns" element={<StoreLayout />}>
                        <Route index element={<ShippingReturns />} />
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
                        <Route path="hall" element={<HallPage />} />
                        <Route path="hall/racks/:rackId" element={<HallRackPage />} />
                        <Route path="hall/racks/:rackId/layers/:layerId" element={<HallLayerPage />} />
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
                    path="/account/*"
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
                <Route path="/my-page/*" element={<LegacyAccountRedirect />} />

                <Route path="/dashboard/*" element={<Navigate to="/monitoring/overview" replace />} />
                <Route path="/monitoring/admin/products" element={<Navigate to="/store/admin/products" replace />} />
                <Route path="/admin/dashboard" element={<Navigate to="/admin/overview" replace />} />
                <Route path="/team" element={<Navigate to="/admin/team" replace />} />
                <Route path="/super-admin" element={<Navigate to="/admin/home" replace />} />
                <Route path="/super-admin/admins" element={<Navigate to="/admin/directory" replace />} />
                <Route path="/store/home" element={<Navigate to="/store" replace />} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </SensorConfigProvider>
    );
}

export default App;
