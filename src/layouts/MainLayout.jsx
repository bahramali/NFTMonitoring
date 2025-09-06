import React from 'react';
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/common/Sidebar";

export default function MainLayout() {
    return (
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <Sidebar />
            <main style={{ flexGrow: 1, overflowY: "auto" }}>
                <Outlet />
            </main>
        </div>
    );
}
