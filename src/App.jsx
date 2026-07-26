import { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import NotificationProvider from './components/Notification';
import useNotificationStore from './store/notificationStore';

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

// Header component with location awareness using window.location
const HeaderWithLocation = ({ collaborationStatus, sidebarCollapsed, setSidebarCollapsed, handleCollaborateClick }) => {
  // Check if we're on the collaboration page using window.location
  const isOnCollaborationPage = window.location.hash.includes('/collaboration');
  
  // Adjust collaboration status based on the current route
  const currentCollaborationStatus = isOnCollaborationPage 
    ? collaborationStatus // Show collaboration status when on collaboration page
    : { isConnected: false, userCount: 1, otherUserCount: 0 }; // Show no collaboration elsewhere

  return (
    <Header
      user={useAuthStore.getState().user}
      onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      onNavigate={(page) => {
        switch(page) {
          case 'dashboard':
            window.location.hash = '#/dashboard';
            break;
          case 'analytics':
            window.location.hash = '#/analytics';
            break;
          case 'ai-models':
            window.location.hash = '#/ai-models';
            break;
          case 'collaboration':
            window.location.hash = '#/collaboration';
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
      liveblocksStatus={currentCollaborationStatus}
      onCollaborateClick={handleCollaborateClick}
    />
  );
};

// Main authenticated layout component
const AuthenticatedLayout = ({ collaborationStatus, sidebarCollapsed, setSidebarCollapsed, handleCollaborateClick }) => {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        isSidebarOpen={!sidebarCollapsed}
        toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        liveblocksStatus={collaborationStatus}
      />

      <div className="flex-1 flex flex-col transition-all duration-300">
        <HeaderWithLocation 
          collaborationStatus={collaborationStatus}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          handleCollaborateClick={handleCollaborateClick}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ai-models" element={<AIModelsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/collaboration" element={<CollaborationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { user, isAuthenticated, isLoading, initAuth } = useAuthStore();
  const { addUserNotification } = useNotificationStore();

  // Use Liveblocks for collaboration status - use a default room name that's generic
  const {
    others,
    otherUserCount, // Get otherUserCount directly from the hook
    isLiveblocksEnabled,
    error
  } = useLiveblocks('dashboard-app', user); // Changed from 'app-main-room' to a more generic name

  // Get collaboration status for UI indicators
  const collaborationStatus = {
    isConnected: isLiveblocksEnabled,
    userCount: others.length + (isLiveblocksEnabled ? 1 : 0), // Total users (others + current)
    otherUserCount: otherUserCount, // Count of other users (excluding current user)
  };

  // Track previous others to detect joins/leaves
  const prevOthersRef = useRef([]);
  
  useEffect(() => {
    // Initialize authentication. initAuth is async, so invoke it inside the
    // effect and capture its cleanup; never return the Promise directly.
    let cleanup;
    initAuth().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [initAuth]);

  // Handle user join/leave notifications
  useEffect(() => {
    const currentOthers = others.map(o => o.presence?.name || `User ${o.connectionId}`);
    const prevOthers = prevOthersRef.current;

    // Find new users who joined
    currentOthers.forEach(current => {
      if (!prevOthers.includes(current)) {
        addUserNotification(current, 'joined');
      }
    });

    // Find users who left
    prevOthers.forEach(prev => {
      if (!currentOthers.includes(prev)) {
        addUserNotification(prev, 'left');
      }
    });

    // Update ref with current others
    prevOthersRef.current = currentOthers;
  }, [others, addUserNotification]);

  // Wrap everything in Router
  const AppContent = () => (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
          path="*"
          element={
            <ProtectedRoute
              isLoading={isLoading}
              isAuthenticated={isAuthenticated}
            >
              <AuthenticatedLayout
                collaborationStatus={collaborationStatus}
                sidebarCollapsed={sidebarCollapsed}
                setSidebarCollapsed={setSidebarCollapsed}
                handleCollaborateClick={useCallback(() => {
                  window.location.hash = '#/collaboration';
                }, [])}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );

  // Conditionally render LiveblocksProvider based on whether client is available
  if (liveblocksClient && publicApiKey) {
    return (
      <LiveblocksProvider publicApiKey={publicApiKey} resolveUsers={resolveUsers} resolveRooms={resolveRooms}>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </LiveblocksProvider>
    );
  } else {
    return (
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    );
  }
}

export default App;