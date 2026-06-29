import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth';
import { LoadingScreen } from '@/components/brutalist';

export function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen label="AUTHORIZING" />;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
