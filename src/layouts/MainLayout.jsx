import React from 'react';
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/common/Sidebar";
import { FiltersProvider } from "../context/FiltersContext";

export default function MainLayout() {
    return (
        <FiltersProvider>
            <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
                <Sidebar />
                <main style={{ flexGrow: 1, overflowY: "auto" }}>
                    <Outlet />
                </main>
            </div>
        </FiltersProvider>
    );
}
