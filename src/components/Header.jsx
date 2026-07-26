import { useState, useRef, useEffect } from 'react'
import { Search, Bell, ChevronDown, Menu, LayoutDashboard, Settings, LogOut, Users, X } from 'lucide-react'
import { searchIndex } from '../data/searchIndex'
import useNotificationStore from '../store/notificationStore'

const TYPE_COLORS = {
  Page: 'bg-indigo-50 text-indigo-600',
  Model: 'bg-emerald-50 text-emerald-600',
  Log: 'bg-amber-50 text-amber-600',
  Setting: 'bg-slate-100 text-slate-600',
}

export default function Header({ user, onMenuToggle, onNavigate, liveblocksStatus = null, onCollaborateClick = null }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const ref = useRef(null)
  const profileRef = useRef(null)
  const notificationsRef = useRef(null)

  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotificationStore()

  const results = query.trim().length > 0
    ? searchIndex.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.page.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
      if (!profileRef.current?.contains(e.target)) setProfileOpen(false)
      if (!notificationsRef.current?.contains(e.target)) setNotificationsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (item) => {
    onNavigate(item.page)
    setQuery('')
    setOpen(false)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60))
      return `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      const diffInHours = Math.floor(diffInHours)
      return `${diffInHours}h ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <header className="h-16 bg-white dark:bg-[var(--color-bg-surface)] border-b border-slate-200 dark:border-[var(--color-border-subtle)] flex items-center justify-between px-4 min-750:px-6 min-1440:px-8">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={onMenuToggle}
          className="min-750:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
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
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[var(--color-bg-canvas)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-lg text-sm text-slate-900 dark:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent"
          />

          {open && results.length > 0 && (
            <ul className="absolute top-full mt-2 w-full bg-white dark:bg-[var(--color-bg-surface)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
              {results.map((item, i) => (
                <li key={i}>
                  <button
                    onMouseDown={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)] transition-colors cursor-pointer text-left"
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
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-[var(--color-bg-surface)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-slate-400">
              No results for "{query}"
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Collaboration button */}
        {onCollaborateClick && (
          <button 
            onClick={onCollaborateClick}
            className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center"
            title="Start Collaboration"
          >
            <Users className="w-5 h-5" />
            {liveblocksStatus && liveblocksStatus.otherUserCount > 0 && (  // Only show when other users are present
              <span 
                className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs text-white ${
                  liveblocksStatus.isConnected ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              >
                {liveblocksStatus.otherUserCount}  {/* Show count of OTHER users */}
              </span>
            )}
          </button>
        )}
        
        {/* Notifications dropdown */}
        <div ref={notificationsRef} className="relative">
          <button
            onClick={() => setNotificationsOpen(v => !v)}
            className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[var(--color-bg-surface)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-3 border-b border-slate-200 dark:border-[var(--color-border-subtle)] flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-[var(--color-text-primary)]">Notifications</h3>
                {notifications.length > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-indigo-600 dark:text-[var(--color-brand-500)] hover:underline cursor-pointer"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  <ul>
                    {notifications.map((notification) => (
                      <li 
                        key={notification.id} 
                        className={`p-3 border-b border-slate-100 dark:border-[var(--color-border-subtle)] last:border-b-0 ${
                          !notification.read ? 'bg-indigo-50 dark:bg-[var(--color-brand-50)]' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">
                                {notification.title || notification.message.split(' ')[0]}
                              </p>
                              {!notification.read && (
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-[var(--color-text-secondary)] mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-[var(--color-text-muted)] mt-1">
                              {formatDate(notification.timestamp)}
                            </p>
                          </div>
                          <button 
                            onClick={() => removeNotification(notification.id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-[var(--color-text-primary)] ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="mt-2 text-xs text-indigo-600 dark:text-[var(--color-brand-500)] hover:underline cursor-pointer"
                          >
                            Mark as read
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-6 text-center">
                    <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No notifications yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-[var(--color-border-subtle)] cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-[var(--color-brand-50)] flex items-center justify-center">
              <span className="text-sm font-medium text-indigo-700 dark:text-[var(--color-brand-500)]">Z</span>
            </div>
            <div className="hidden min-750:block text-left">
              <p className="text-sm font-semibold text-slate-700 dark:text-[var(--color-text-primary)]">{user?.name || user?.email || 'Zac Admin'}</p>
              <p className="text-xs text-slate-500">{user?.email || 'admin@zac.ai'}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-3 w-56 bg-white dark:bg-[var(--color-bg-surface)] border border-slate-200 dark:border-[var(--color-border-subtle)] rounded-xl shadow-lg z-50 overflow-hidden">
              {/* Mobile-only user info */}
              <div className="min-750:hidden px-4 py-3 border-b border-slate-100 dark:border-[var(--color-border-subtle)]">
                <p className="text-sm font-semibold text-slate-800 dark:text-[var(--color-text-primary)]">{user?.name || 'Zac Admin'}</p>
                <p className="text-xs text-slate-500">{user?.email || 'admin@zac.ai'}</p>
              </div>

              <div className="py-1">
                <button
                  onMouseDown={() => { onNavigate('dashboard'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-[var(--color-text-primary)] hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)] transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4 text-slate-400" /> Dashboard
                </button>
                <button
                  onMouseDown={() => { onNavigate('settings'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-[var(--color-text-primary)] hover:bg-slate-50 dark:hover:bg-[var(--color-bg-canvas)] transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-400" /> Settings
                </button>
              </div>

              <div className="border-t border-slate-100 dark:border-[var(--color-border-subtle)] py-1">
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