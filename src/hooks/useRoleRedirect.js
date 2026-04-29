import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/useAuthStore';

export default function useRoleRedirect() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    if (user.role === 'guest' && !window.location.pathname.startsWith('/guest')) {
      navigate('/guest/home');
    } else if (user.role === 'admin' && !window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/dashboard')) {
      navigate('/admin');
    } else if (user.role === 'staff' && !window.location.pathname.startsWith('/dashboard')) {
      navigate('/dashboard');
    }
  }, [user, navigate]);
}
