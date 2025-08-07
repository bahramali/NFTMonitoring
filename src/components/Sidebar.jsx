
import { useState } from 'react';
import { FaHome, FaChartLine, FaCog, FaUser, FaBook, FaChevronRight } from 'react-icons/fa';
import './Sidebar.css';

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);

    const toggle = () => setCollapsed(!collapsed);

    return (
        <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <button className="toggle-btn" onClick={toggle}>
                    <FaChevronRight className={collapsed ? 'rotate' : ''} />
                </button>
                {!collapsed && <h1 className="company">Company</h1>}
            </div>

            <div className="sidebar-menu">
                <SidebarItem icon={<FaHome />} text="Dashboard" collapsed={collapsed} />
                <SidebarItem icon={<FaChartLine />} text="Reports" collapsed={collapsed} />
                <SidebarItem icon={<FaCog />} text="Settings" collapsed={collapsed} />
                <SidebarItem icon={<FaUser />} text="User Info" collapsed={collapsed} />
                <SidebarItem icon={<FaBook />} text="Documentation" collapsed={collapsed} />
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-filter">
                {!collapsed && <div className="filter-title">SYSTEM FILTER</div>}
                <SidebarItem icon={<FaChevronRight />} text="Device" collapsed={collapsed} />
                <SidebarItem icon={<FaChevronRight />} text="Layer" collapsed={collapsed} />
                <SidebarItem icon={<FaChevronRight />} text="System" collapsed={collapsed} />
            </div>
        </div>
    );
}

function SidebarItem({ icon, text, collapsed }) {
    return (
        <div className="sidebar-item">
            <span className="icon">{icon}</span>
            {!collapsed && <span className="text">{text}</span>}
        </div>
    );
}
