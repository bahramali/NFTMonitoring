import React, { useMemo } from 'react';
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../pages/common/Sidebar";

export default function MainLayout() {
    const location = useLocation();

    const isCamerasRoute = location.pathname?.startsWith("/cameras");

    const layoutStyle = useMemo(
        () => ({
            display: "flex",
            height: "100vh",
            overflow: "hidden",
            background: isCamerasRoute ? "#050b16" : "#f1f5f9",
        }),
        [isCamerasRoute],
    );

    const mainStyle = useMemo(
        () => ({
            flexGrow: 1,
            overflowY: "auto",
            background: isCamerasRoute ? "transparent" : "#ffffff",
            color: isCamerasRoute ? "#e6edff" : "#0f172a",
            padding: isCamerasRoute ? "0" : "2.25rem 2.75rem",
            boxSizing: "border-box",
        }),
        [isCamerasRoute],
    );

    return (
        <div style={layoutStyle}>
            <Sidebar />
            <main style={mainStyle}>
                <Outlet />
            </main>
        </div>
    );
}
