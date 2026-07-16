import { useState, useCallback } from 'react'
import { Bot } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import DashboardPage from './features/dashboard/DashboardPage'
import AIModelsPage from './features/ai-models/AIModelsPage'
import AnalyticsPage from './features/analytics/AnalyticsPage'
import SettingsPage from './features/settings/SettingsPage'
import LoginPage from './features/auth/LoginPage'
import SignupPage from './features/auth/SignupPage'
import CollaborationPage from './features/collaboration/CollaborationPage'

function PageLoader({ visible }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300"
      style={{
        backgroundColor: 'var(--color-bg-canvas)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'all' : 'none',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center"
        style={{
          animation: visible ? 'zac-pulse 900ms ease-in-out infinite' : 'none',
        }}
      >
        <Bot className="w-5 h-5 text-white" />
      </div>

      <style>{`
        @keyframes zac-pulse {
          0%   { transform: scale(1);    opacity: 1; }
          50%  { transform: scale(1.35); opacity: 0.7; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState('login')
  const [loading, setLoading] = useState(false)
  const [visiblePage, setVisiblePage] = useState('login')

  const navigate = useCallback((page) => {
    if (page === currentPage) return
    setLoading(true)
    setTimeout(() => {
      setCurrentPage(page)
      setVisiblePage(page)
      setTimeout(() => setLoading(false), 150)
    }, 500)
  }, [currentPage])

  const authPages = ['login', 'signup']
  const isAuth = authPages.includes(currentPage)

  const renderPage = () => {
    switch (visiblePage) {
      case 'login':     return <LoginPage onNavigate={navigate} />
      case 'signup':    return <SignupPage onNavigate={navigate} />
      case 'dashboard': return <DashboardPage />
      case 'ai-models': return <AIModelsPage />
      case 'analytics':      return <AnalyticsPage />
      case 'collaboration':   return <CollaborationPage />
      case 'settings':        return <SettingsPage />
      default:          return <DashboardPage />
    }
  }

  if (isAuth) return (
    <>
      <PageLoader visible={loading} />
      {renderPage()}
    </>
  )

  return (
    <>
      <PageLoader visible={loading} />
      <div className="flex h-screen bg-slate-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={navigate} currentPage={currentPage} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuToggle={() => setSidebarOpen(true)} onNavigate={navigate} />
          <main className="flex-1 overflow-y-auto p-4 min-750:p-6 min-1440:p-8">
            {renderPage()}
          </main>
        </div>
      </div>
    </>
  )
}

export default App
