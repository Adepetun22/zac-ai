import { useState, useRef, useEffect } from 'react'
import { Search, Bell, ChevronDown, Menu, LayoutDashboard, Settings, LogOut } from 'lucide-react'
import { searchIndex } from '../data/searchIndex'

const TYPE_COLORS = {
  Page: 'bg-indigo-50 text-indigo-600',
  Model: 'bg-emerald-50 text-emerald-600',
  Log: 'bg-amber-50 text-amber-600',
  Setting: 'bg-slate-100 text-slate-600',
}

export default function Header({ onMenuToggle, onNavigate }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const ref = useRef(null)
  const profileRef = useRef(null)

  const results = query.trim().length > 0
    ? searchIndex.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
      if (!profileRef.current?.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (item) => {
    onNavigate(item.page)
    setQuery('')
    setOpen(false)
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 min-750:px-6 min-1440:px-8">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={onMenuToggle}
          className="min-1440:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div ref={ref} className="relative flex-1 max-w-[500px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => query.trim() && setOpen(true)}
            placeholder="Search prompts, models, logs..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />

          {open && results.length > 0 && (
            <ul className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {results.map((item, i) => (
                <li key={i}>
                  <button
                    onMouseDown={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[item.type]}`}>
                      {item.type}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
                      <p className="text-xs text-slate-400 truncate">{item.description}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {open && query.trim().length > 0 && results.length === 0 && (
            <div className="absolute top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-slate-400">
              No results for "{query}"
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-3 pl-4 border-l border-slate-200 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-sm font-medium text-indigo-700">Z</span>
            </div>
            <div className="hidden min-750:block text-left">
              <p className="text-sm font-medium text-slate-700">Zac Admin</p>
              <p className="text-xs text-slate-500">admin@zac.ai</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-3 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {/* Mobile-only user info */}
              <div className="min-750:hidden px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">Zac Admin</p>
                <p className="text-xs text-slate-500">admin@zac.ai</p>
              </div>

              <div className="py-1">
                <button
                  onMouseDown={() => { onNavigate('dashboard'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4 text-slate-400" /> Dashboard
                </button>
                <button
                  onMouseDown={() => { onNavigate('settings'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-400" /> Settings
                </button>
              </div>

              <div className="border-t border-slate-100 py-1">
                <button
                  onMouseDown={() => { onNavigate('login'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
