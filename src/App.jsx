import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LiveblocksProvider } from '@liveblocks/react';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardPage from './features/dashboard/DashboardPage';
import AIModelsPage from './features/ai-models/AIModelsPage';
import AnalyticsPage from './features/analytics/AnalyticsPage';
import CollaborationPage from './features/collaboration/CollaborationPage';
import SettingsPage from './features/settings/SettingsPage';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import useAuthStore from './store/authStore';
import { liveblocksClient, publicApiKey } from './config/liveblocks';
import { resolveUsers, resolveRooms } from './liveblocks.config';
import { useLiveblocks } from './hooks/useLiveblocks';

// ProtectedRoute component
const ProtectedRoute = ({ children, isLoading, isAuthenticated }) => {
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// PublicRoute component (redirects if already logged in)
const PublicRoute = ({ children, isLoading, isAuthenticated }) => {
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

// AppContent component extracted outside to avoid creation during render
const AppContent = ({ collaborationStatus, sidebarCollapsed, setSidebarCollapsed, isLoading, isAuthenticated }) => {
  const handleCollaborateClick = useCallback(() => {
    // Navigate to collaboration page when clicking the collaboration button
    window.location.hash = '#/collaboration';
  }, []);

  return (
    <Router>
      <div className="flex h-screen bg-slate-50">
        <Sidebar
          isSidebarOpen={!sidebarCollapsed}
          toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          liveblocksStatus={collaborationStatus}
        />

        <div className="flex-1 flex flex-col transition-all duration-300">
          <Header
            onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            onNavigate={(page) => {
              switch(page) {
                case 'dashboard':
                  window.location.hash = '#/dashboard';
                  break;
                case 'settings':
                  window.location.hash = '#/settings';
                  break;
                case 'login':
                  window.location.hash = '#/login';
                  break;
                default:
                  break;
              }
            }}
            liveblocksStatus={collaborationStatus}
            onCollaborateClick={handleCollaborateClick}
          />

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicRoute
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                  >
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <PublicRoute
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                  >
                    <SignupPage />
                  </PublicRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                  >
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai-models"
                element={
                  <ProtectedRoute
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                  >
                    <AIModelsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                  >
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collaboration"
                element={
                  <ProtectedRoute
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                  >
                    <CollaborationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute
                    isLoading={isLoading}
                    isAuthenticated={isAuthenticated}
                  >
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { isAuthenticated, isLoading, initAuth } = useAuthStore();

  // Use Liveblocks for collaboration status
  const {
    others,
    isLiveblocksEnabled
  } = useLiveblocks('app-main-room');

  // Get collaboration status for UI indicators
  const collaborationStatus = {
    isConnected: isLiveblocksEnabled,
    userCount: others.length + (isLiveblocksEnabled ? 1 : 0), // +1 for current user if enabled
  };

  useEffect(() => {
    // Initialize authentication. initAuth is async, so invoke it inside the
    // effect and capture its cleanup; never return the Promise directly.
    let cleanup;
    initAuth().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [initAuth]);

  // Conditionally render LiveblocksProvider based on whether client is available
  if (liveblocksClient && publicApiKey) {
    return (
      <LiveblocksProvider publicApiKey={publicApiKey} resolveUsers={resolveUsers} resolveRooms={resolveRooms}>
        <AppContent
          collaborationStatus={collaborationStatus}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          isLoading={isLoading}
          isAuthenticated={isAuthenticated}
        />
      </LiveblocksProvider>
    );
  } else {
    return (
      <AppContent
        collaborationStatus={collaborationStatus}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        isLoading={isLoading}
        isAuthenticated={isAuthenticated}
      />
    );
  }
}

export default App;
