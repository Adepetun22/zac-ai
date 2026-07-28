import { create } from 'zustand';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  // Add a new notification with rate limiting
  addNotification: (notification) => {
    const id = Date.now() + Math.random(); // Generate unique ID
    
    // Rate limiting: Prevent duplicate notifications within a short timeframe
    const existingNotification = get().notifications.find(n => 
      n.message === notification.message && 
      Date.now() - new Date(n.timestamp).getTime() < 2000 // 2 seconds
    );
    
    if (existingNotification) {
      // Skip adding if duplicate notification occurred recently
      return;
    }
    
    const newNotification = {
      id,
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };
    
    set(state => {
      const updatedNotifications = [newNotification, ...state.notifications];
      // Limit total notifications to prevent memory issues
      const limitedNotifications = updatedNotifications.slice(0, 50); // Keep only latest 50
      const unreadCount = limitedNotifications.filter(n => !n.read).length;
      return {
        notifications: limitedNotifications,
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
  
  // Add system notification for user joining/leaving collaboration with rate limiting
  addUserNotification: (userName, action) => {
    const message = action === 'joined' 
      ? `${userName} joined the collaboration`
      : `${userName} left the collaboration`;
      
    // Check if the same user join/leave action happened recently to prevent spam
    const recentNotification = get().notifications.find(n => 
      n.message === message && 
      Date.now() - new Date(n.timestamp).getTime() < 5000 // 5 seconds
    );
    
    if (recentNotification) {
      return; // Skip if same notification occurred within 5 seconds
    }
    
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