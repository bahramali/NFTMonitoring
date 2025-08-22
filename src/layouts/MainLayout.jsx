import React from 'react';
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/common/Sidebar";
import { FiltersProvider } from "../context/FiltersContext";

export default function MainLayout() {
    return (
    <FiltersProvider>
      <div style={{ display: "flex" }}>
            <Sidebar />
            <main style={{ flexGrow: 1 }}>
                <Outlet />
            </main>
        </div>
    </FiltersProvider>
    );
}
