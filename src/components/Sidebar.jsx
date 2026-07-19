/* eslint-disable no-unused-vars */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ isSidebarOpen, toggleSidebar, liveblocksStatus = null }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/analytics', label: 'Analytics', icon: '📈' },
    { path: '/ai-models', label: 'AI Models', icon: '🤖' },
    { path: '/collaboration', label: 'Collaboration', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <>
      {/* Mobile overlay — closes the drawer when tapped */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 min-750:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`bg-slate-900 text-slate-200 w-64 shrink-0 h-screen transition-transform duration-300 ease-in-out
          fixed inset-y-0 left-0 z-50 min-750:static min-750:z-auto min-750:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Main navigation"
      >
        <div className="h-16 flex items-center px-5 border-b border-slate-700/60">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center mr-3 bg-[var(--color-brand-500)] text-white text-sm font-bold">Z</span>
          <h1 className="text-lg font-bold text-white">Zac AI Dashboard</h1>
        </div>

        {/* Collaboration Status Indicator */}
        {liveblocksStatus && (
          <div className="px-4 py-3 border-b border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Collaboration</span>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${liveblocksStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs">{liveblocksStatus.userCount} online</span>
              </div>
            </div>
          </div>
        )}

        <nav className="mt-5">
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={toggleSidebar}
                  className={`flex items-center p-3 mx-2 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-[var(--color-brand-500)] text-white'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                >
                  <span className="mr-3 text-lg" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
