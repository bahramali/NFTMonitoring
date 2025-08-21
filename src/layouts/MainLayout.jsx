import React from 'react';
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { FiltersProvider } from "../features/dashboard/FiltersContext";

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
