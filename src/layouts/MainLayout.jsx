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
                background: "#040914",
            }}
        >
            <Sidebar />
            <main
                style={{
                    flexGrow: 1,
                    overflowY: "auto",
                    background: "radial-gradient(circle at top, rgba(42, 74, 140, 0.35), transparent 55%), #050b18",
                    color: "#e5ecff",
                    padding: "2.25rem 2.75rem",
                    boxSizing: "border-box",
                }}
            >
                <Outlet />
            </main>
        </div>
    );
}
