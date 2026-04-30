import { create } from 'zustand';

const normalizeUser = (userData) => {
  if (!userData) return null;
  return {
    ...userData,
    role: String(userData.role || '').toLowerCase().trim(),
  };
};

const getStoredUser = () => {
  try {
    return normalizeUser(JSON.parse(localStorage.getItem('hotelos_user') || 'null'));
  } catch {
    localStorage.removeItem('hotelos_user');
    return null;
  }
};

const useAuthStore = create((set) => ({
  user: getStoredUser(),
  token: localStorage.getItem('hotelos_token') || null,
  
  login: (userData, token) => {
    const normalizedUser = normalizeUser(userData);
    localStorage.setItem('hotelos_user', JSON.stringify(normalizedUser));
    localStorage.setItem('hotelos_token', token);
    set({ user: normalizedUser, token });
    return normalizedUser;
  },
  
  logout: () => {
    localStorage.removeItem('hotelos_user');
    localStorage.removeItem('hotelos_token');
    set({ user: null, token: null });
  }
}));

export default useAuthStore;
