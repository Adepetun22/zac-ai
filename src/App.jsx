import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import useCollaborationStore from './store/collaborationStore';
import NotificationProvider from './components/Notification';
import { backendPath } from './services/apiClient';

const LandingPage = lazy(() => import('./features/landing/LandingPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const AIModelsPage = lazy(() => import('./features/ai-models/AIModelsPage'));
const AnalyticsPage = lazy(() => import('./features/analytics/AnalyticsPage'));
const CollaborationPage = lazy(() => import('./features/collaboration/CollaborationPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const SignupPage = lazy(() => import('./features/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));
const FeaturesPage = lazy(() => import('./features/pages/FeaturesPage'));
const HowItWorksPage = lazy(() => import('./features/pages/HowItWorksPage'));
const AdvantagesPage = lazy(() => import('./features/pages/AdvantagesPage'));

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
  </div>
);

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

// Header component with location awareness from react-router
const HeaderWithLocation = ({ collaborationStatus, sidebarCollapsed, setSidebarCollapsed, handleCollaborateClick, connectedUsers = [] }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Route-aware, so the indicator reacts to navigation instead of only to mount
  const isOnCollaborationPage = pathname === '/collaboration';
  
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
            navigate('/dashboard');
            break;
          case 'analytics':
            navigate('/analytics');
            break;
          case 'ai-models':
            navigate('/ai-models');
            break;
          case 'collaboration':
            navigate('/collaboration');
            break;
          case 'settings':
            navigate('/settings');
            break;
          case 'login':
            navigate('/login');
            break;
          default:
            break;
        }
      }}
      liveblocksStatus={currentCollaborationStatus}
      onCollaborateClick={handleCollaborateClick}
      connectedUsers={connectedUsers}
    />
  );
};

// Main authenticated layout component
const AuthenticatedLayout = ({ collaborationStatus, sidebarCollapsed, setSidebarCollapsed, connectedUsers = [] }) => {
  // Owned here rather than in App: AuthenticatedLayout is rendered as a route
  // element, so it sits inside the Router and can use useNavigate(). App builds
  // the Router itself and therefore cannot.
  const navigate = useNavigate();
  const handleCollaborateClick = useCallback(() => {
    navigate('/collaboration');
  }, [navigate]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        isSidebarOpen={!sidebarCollapsed}
        toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        liveblocksStatus={collaborationStatus}
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <HeaderWithLocation 
          collaborationStatus={collaborationStatus}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          handleCollaborateClick={handleCollaborateClick}
          connectedUsers={connectedUsers}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto min-w-0">
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
  const { isAuthenticated, isLoading, initAuth } = useAuthStore();
  const { initTheme } = useThemeStore();
  const { peerList } = useCollaborationStore();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

  useEffect(() => {
    if (!backendUrl) return;

    const ping = async () => {
      try {
        await fetch(backendPath('/health'), { mode: 'no-cors' });
      } catch {
        // ignore ping failures
      }
    };

    ping();
    const id = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [backendUrl]);

  // Initialize persisted theme/accent on app load
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // Initialize authentication. initAuth is async, so invoke it inside the
  // effect and capture its cleanup; never return the Promise directly.
  useEffect(() => {
    let cleanup;
    initAuth().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [initAuth]);

  const collaborationStatus = {
    isConnected: peerList.length > 0,
    userCount: peerList.length + 1,
    otherUserCount: peerList.length,
  };

  const innerContent = (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
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
          path="/forgot-password"
          element={
            <PublicRoute
              isLoading={isLoading}
              isAuthenticated={isAuthenticated}
            >
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        {/* Not wrapped in PublicRoute: the recovery link establishes a session,
            so isAuthenticated is true and PublicRoute would bounce the user to
            the dashboard before they can set a new password. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/"
          element={
            <PublicRoute
              isLoading={isLoading}
              isAuthenticated={isAuthenticated}
            >
              <LandingPage />
            </PublicRoute>
          }
        />
        <Route
          path="/features"
          element={
            <PublicRoute
              isLoading={isLoading}
              isAuthenticated={isAuthenticated}
            >
              <FeaturesPage />
            </PublicRoute>
          }
        />
        <Route
          path="/how-it-works"
          element={
            <PublicRoute
              isLoading={isLoading}
              isAuthenticated={isAuthenticated}
            >
              <HowItWorksPage />
            </PublicRoute>
          }
        />
        <Route
          path="/advantages"
          element={
            <PublicRoute
              isLoading={isLoading}
              isAuthenticated={isAuthenticated}
            >
              <AdvantagesPage />
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
                connectedUsers={peerList}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </Router>
  );

  return (
    <NotificationProvider>
      {innerContent}
    </NotificationProvider>
  );
}

export default App;
