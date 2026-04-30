import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';
import { isStaffRole } from '../utils/roles';

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
  if (!user || (user.role !== 'admin' && !isStaffRole(user.role))) return <Navigate to="/" replace />;
  return <Outlet />;
};
