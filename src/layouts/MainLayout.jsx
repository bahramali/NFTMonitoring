import React from 'react';
import { Outlet } from "react-router-dom";
import Sidebar from "../pages/common/Sidebar";

export default function MainLayout() {
    return (
        <div
            style={{
                display: "flex",
                height: "100vh",
                overflow: "hidden",
                background: "#f1f5f9",
            }}
        >
            <Sidebar />
            <main
                style={{
                    flexGrow: 1,
                    overflowY: "auto",
                    background: "#ffffff",
                    color: "#0f172a",
                    padding: "2.25rem 2.75rem",
                    boxSizing: "border-box",
                }}
            >
                <Outlet />
            </main>
        </div>
    );
}
