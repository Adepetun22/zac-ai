import { useState, useCallback, useEffect, useMemo } from 'react';
import { NotificationContext } from './NotificationContext';
import useNotificationStore from '../store/notificationStore';

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
      className={`relative mb-3 w-full max-w-sm rounded-lg border p-4 shadow-lg transition-all duration-200 ${
        config.bg
      } ${config.border} ${config.text} ${
        isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
            config.accent
          }`}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          {notification.title && (
            <p className="font-medium mb-1">{notification.title}</p>
          )}
          <p className="text-sm">{notification.message}</p>
        </div>
        <button
          onClick={handleClose}
          className="ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-current hover:opacity-70 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      <div className="absolute bottom-0 left-0 h-1 bg-current opacity-10">
        <div
          className={`h-full ${config.accent}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}

function NotificationContainer({ notifications, onRemove }) {
  const notificationItems = useMemo(() => {
    // Only show toast notifications (not the persistent ones shown in header)
    const toastNotifications = notifications.filter(n => n.showInToast !== false);
    return toastNotifications.slice(0, 5); // Limit to 5 toasts
  }, [notifications]);

  if (notificationItems.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex w-full max-w-xs flex-col items-end space-y-2 pointer-events-none">
      {notificationItems.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

export default function NotificationProvider({ children }) {
  const { notifications, addNotification: addNotificationToStore, removeNotification: removeNotificationFromStore } = useNotificationStore();

  // Add notification to store with toast display and rate limiting
  const addNotification = useCallback((message, type = 'info', title = null, duration = 5000) => {
    // Check for duplicate notifications in the last 2 seconds
    const recentDuplicate = notifications.some(n => 
      n.message === message && 
      Date.now() - new Date(n.timestamp).getTime() < 2000
    );
    
    if (recentDuplicate) {
      return; // Skip adding duplicate notification
    }
    
    addNotificationToStore({
      message,
      type,
      title,
      duration,
      showInToast: true // Show in toast notification
    });
  }, [addNotificationToStore, notifications]);

  // Remove notification from store
  const removeNotification = useCallback((id) => {
    removeNotificationFromStore(id);
  }, [removeNotificationFromStore]);

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification }}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  );
}