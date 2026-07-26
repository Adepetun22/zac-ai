import { create } from 'zustand';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  // Add a new notification
  addNotification: (notification) => {
    const id = Date.now() + Math.random(); // Generate unique ID
    const newNotification = {
      id,
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };
    
    set(state => {
      const updatedNotifications = [newNotification, ...state.notifications];
      const unreadCount = updatedNotifications.filter(n => !n.read).length;
      return {
        notifications: updatedNotifications,
        unreadCount
      };
    });
  },
  
  // Mark a notification as read
  markAsRead: (id) => {
    set(state => {
      const updatedNotifications = state.notifications.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      );
      const unreadCount = updatedNotifications.filter(n => !n.read).length;
      return {
        notifications: updatedNotifications,
        unreadCount
      };
    });
  },
  
  // Mark all notifications as read
  markAllAsRead: () => {
    set(state => ({
      notifications: state.notifications.map(notification => ({ ...notification, read: true })),
      unreadCount: 0
    }));
  },
  
  // Remove a notification
  removeNotification: (id) => {
    set(state => {
      const updatedNotifications = state.notifications.filter(notification => notification.id !== id);
      const unreadCount = updatedNotifications.filter(n => !n.read).length;
      return {
        notifications: updatedNotifications,
        unreadCount
      };
    });
  },
  
  // Clear all notifications
  clearAllNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  },
  
  // Add system notification for user joining/leaving collaboration
  addUserNotification: (userName, action) => {
    const message = action === 'joined' 
      ? `${userName} joined the collaboration`
      : `${userName} left the collaboration`;
      
    get().addNotification({
      type: 'collaboration',
      title: 'Collaboration Update',
      message,
      user: userName,
      action
    });
  }
}));

export default useNotificationStore;