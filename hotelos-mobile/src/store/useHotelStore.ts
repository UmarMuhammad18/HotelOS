/**
 * Global hotel state — mirrors web useWebSocketStore shape where possible.
 * Persists cached rooms/events for offline banner support.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type FeedEvent = {
  type: string;
  agent?: string;
  message: string;
  details?: string;
  timestamp?: string;
  room?: string;
  status?: string;
};

export type RoomRow = {
  id: string;
  number: string;
  floor: number;
  type: string;
  status: string;
  guest_id?: string | null;
  rate?: number;
};

export type TaskRow = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assignedTo?: string | null;
  createdAt?: string;
  completedAt?: string | null;
};

type State = {
  isConnected: boolean;
  connectionError: string | null;
  reconnectAttempts: number;
  events: FeedEvent[];
  lastEvent: FeedEvent | null;
  notifications: { id: number; title: string; message: string; type: string; timestamp: string; read: boolean }[];
  unreadCount: number;
  tasks: TaskRow[];
  rooms: RoomRow[];
  metrics: {
    occupancy_rate: number;
    revenue_today: number;
    pending_tasks: number;
    occupied_rooms: number;
    total_rooms: number;
  } | null;
  token: string | null;
  userName: string | null;
  offlineMode: boolean;
  /** Increment after changing API base URL so sockets and HTTP refresh */
  configVersion: number;
  bumpConfig: () => void;
  setConnected: (v: boolean, err?: string | null) => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
  addEvent: (e: FeedEvent) => void;
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
  setRooms: (rooms: RoomRow[]) => void;
  setTasks: (tasks: TaskRow[]) => void;
  patchTask: (id: string, patch: Partial<TaskRow>) => void;
  setMetrics: (m: State['metrics']) => void;
  setToken: (token: string | null, name?: string | null) => void;
  setOfflineMode: (v: boolean) => void;
  clearEvents: () => void;
};

export const useHotelStore = create<State>()(
  persist(
    (set, get) => ({
      isConnected: false,
      connectionError: null,
      reconnectAttempts: 0,
      events: [],
      lastEvent: null,
      notifications: [],
      unreadCount: 0,
      tasks: [],
      rooms: [],
      metrics: null,
      token: null,
      userName: null,
      offlineMode: false,
      configVersion: 0,
      bumpConfig: () => set((s) => ({ configVersion: s.configVersion + 1 })),

      setConnected: (connected, err = null) =>
        set({ isConnected: connected, connectionError: err ?? null, offlineMode: !connected && get().rooms.length > 0 }),

      incrementReconnect: () => set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 })),
      resetReconnect: () => set({ reconnectAttempts: 0 }),

      addEvent: (event) => {
        set((state) => {
          const newEvents = [event, ...state.events].slice(0, 100);
          let newNotifications = [...state.notifications];
          let unreadDelta = 0;
          if (event.type === 'alert' || event.type === 'decision') {
            newNotifications = [
              {
                id: Date.now(),
                title: event.agent || 'System',
                message: event.message,
                type: event.type,
                timestamp: event.timestamp || new Date().toISOString(),
                read: false,
              },
              ...newNotifications,
            ].slice(0, 50);
            unreadDelta = 1;
          }
          let newTasks = [...state.tasks];
          if (event.type === 'alert' && event.message.toLowerCase().includes('maintenance')) {
            newTasks = [
              {
                id: `local-${Date.now()}`,
                title: 'Maintenance Required',
                description: event.message,
                status: 'pending',
                priority: 'high',
                assignedTo: null,
                createdAt: new Date().toISOString(),
              },
              ...newTasks,
            ];
          }
          if (event.type === 'status_change' && event.room && event.status) {
            newTasks = newTasks.map((t) => ({ ...t }));
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

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),

      markAllNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      })),

      setRooms: (rooms) => set({ rooms }),
      setTasks: (tasks) => set({ tasks }),
      patchTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      setMetrics: (metrics) => set({ metrics }),
      setToken: (token, userName = null) => set({ token, userName }),
      setOfflineMode: (offlineMode) => set({ offlineMode }),
      clearEvents: () => set({ events: [], lastEvent: null }),
    }),
    {
      name: 'hotelos-cache',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        rooms: s.rooms,
        events: s.events.slice(0, 30),
        tasks: s.tasks,
        token: s.token,
        userName: s.userName,
        metrics: s.metrics,
      }),
    }
  )
);
