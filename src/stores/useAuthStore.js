import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('hotelos_user') || 'null'),
  token: localStorage.getItem('hotelos_token') || null,
  
  login: (userData, token) => {
    localStorage.setItem('hotelos_user', JSON.stringify(userData));
    localStorage.setItem('hotelos_token', token);
    set({ user: userData, token });
  },
  
  logout: () => {
    localStorage.removeItem('hotelos_user');
    localStorage.removeItem('hotelos_token');
    set({ user: null, token: null });
  }
}));

export default useAuthStore;
