import { create } from 'zustand';

const useWebSocketStore = create((set, get) => ({
  // WebSocket state
  isConnected: false,
  events: [],
  lastEvent: null,
  connectionError: null,
  reconnectAttempts: 0,

  // Notifications
  notifications: [],
  unreadCount: 0,

  // Tasks
  tasks: [],

  // Guest profiles (mock data)
  guests: {},

  setConnected: (connected) => set({ isConnected: connected, connectionError: null }),
  setConnectionError: (error) => set({ connectionError: error }),

  addEvent: (event) => {
    set((state) => {
      // Add to events list
      const newEvents = [event, ...state.events].slice(0, 100);

      // Add notification for certain event types
      let newNotifications = [...state.notifications];
      let unreadDelta = 0;
      if (event.type === 'alert' || event.type === 'decision') {
        const notification = {
          id: Date.now(),
          title: event.agent || 'System',
          message: event.message,
          type: event.type,
          timestamp: new Date().toISOString(),
          read: false,
        };
        newNotifications = [notification, ...newNotifications].slice(0, 50);
        unreadDelta = 1;
      }

      // Auto-create tasks for maintenance alerts
      let newTasks = [...state.tasks];
      if (event.type === 'alert' && event.message.toLowerCase().includes('maintenance')) {
        const task = {
          id: Date.now(),
          title: 'Maintenance Required',
          description: event.message,
          status: 'pending',
          priority: 'high',
          assignedTo: null,
          createdAt: new Date().toISOString(),
        };
        newTasks = [task, ...newTasks];
      }

      return {
        events: newEvents,
        lastEvent: event,
        notifications: newNotifications,
        unreadCount: state.unreadCount + unreadDelta,
        tasks: newTasks,
      };
    });
  },

  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),

  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTaskStatus: (id, status) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, status } : t)
  })),

  assignTask: (id, staffName) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, assignedTo: staffName, status: 'in-progress' } : t)
  })),

  clearEvents: () => set({ events: [], lastEvent: null }),
  incrementReconnectAttempts: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
}));

export default useWebSocketStore;