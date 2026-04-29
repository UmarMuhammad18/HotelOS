import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';

export const GuestProtectedRoute = () => {
  const { user } = useAuthStore();
  if (!user || user.role !== 'guest') return <Navigate to="/" replace />;
  return <Outlet />;
};

export const AdminProtectedRoute = () => {
  const { user } = useAuthStore();
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
};

export const StaffProtectedRoute = () => {
  const { user } = useAuthStore();
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) return <Navigate to="/" replace />;
  return <Outlet />;
};
