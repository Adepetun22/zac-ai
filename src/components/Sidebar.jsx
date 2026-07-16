import { LayoutDashboard, Bot, BarChart3, Settings, X, Users } from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
  { icon: Bot, label: 'AI Models', page: 'ai-models' },
  { icon: Users, label: 'Collaboration', page: 'collaboration' },
  { icon: BarChart3, label: 'Analytics', page: 'analytics' },
  { icon: Settings, label: 'Settings', page: 'settings' },
]

export default function Sidebar({ isOpen, onClose, onNavigate, currentPage }) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 min-1440:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col
          transform transition-transform duration-300 ease-in-out
          min-1440:relative min-1440:translate-x-0 min-1440:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Zac AI</h1>
          </div>
          <button
            onClick={onClose}
            className="min-1440:hidden p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.page}
              onClick={() => {
                onNavigate(item.page)
                onClose?.()
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                currentPage === item.page
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-2">API Usage</p>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '72%' }}></div>
            </div>
            <p className="text-xs text-slate-400">72% of monthly limit</p>
          </div>
        </div>
      </aside>
    </>
  )
}
