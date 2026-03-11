import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

const PrivateRoute = () => {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const loading = useAppSelector((s) => s.auth.loading);

  if (loading) return null;

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
