import { useState, useCallback, useEffect } from 'react';
import { NotificationContext } from './NotificationContext';

const TYPE_CONFIG = {
  success: {
    icon: '✓',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-800 dark:text-emerald-200',
    accent: 'bg-emerald-500',
  },
  error: {
    icon: '✕',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    accent: 'bg-red-500',
  },
  warning: {
    icon: '⚠',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
    accent: 'bg-amber-500',
  },
  info: {
    icon: 'ℹ',
    bg: 'bg-indigo-50 dark:bg-[var(--color-brand-50)]',
    border: 'border-indigo-200 dark:border-[var(--color-brand-700)]',
    text: 'text-indigo-800 dark:text-[var(--color-brand-500)]',
    accent: 'bg-[var(--color-brand-500)]',
  },
};

function NotificationItem({ notification, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;

  useEffect(() => {
    if (!notification.duration || notification.duration <= 0) return;

    const startTime = Date.now();
    const totalDuration = notification.duration;
    const interval = 50;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = totalDuration - elapsed;
      const percentage = (remaining / totalDuration) * 100;

      if (percentage <= 0) {
        clearInterval(timer);
        setIsExiting(true);
        setTimeout(() => onRemove(notification.id), 200);
      } else {
        setProgress(percentage);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [notification.id, notification.duration, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(notification.id), 200);
  };

  return (
    <div
      role="alert"
      className={`
        relative flex items-start gap-3 p-4 rounded-lg border shadow-sm
        min-w-[320px] max-w-sm
        ${config.bg} ${config.border} ${config.text}
        transition-all duration-200 ease-out
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: 'var(--color-brand-500)',
      }}
    >
      <span className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-bg-surface)] text-xs font-bold text-[var(--color-text-primary)] shadow-sm shrink-0">
        {config.icon}
      </span>

      <div className="flex-1 min-w-0">
        {notification.title && (
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">
            {notification.title}
          </p>
        )}
        <p className="text-sm text-[var(--color-text-secondary)] leading-snug">
          {notification.message}
        </p>
      </div>

      <button
        onClick={handleClose}
        className="shrink-0 mt-0.5 p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {notification.duration && notification.duration > 0 && (
        <div
          className="absolute bottom-0 left-0 h-1 rounded-b-lg bg-[var(--color-brand-500)] opacity-60 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
}

function NotificationContainer({ notifications, onRemove }) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'info', title, duration = 4000) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type, title, duration }]);
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification }}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
