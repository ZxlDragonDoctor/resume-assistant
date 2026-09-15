/**
 * 登录守卫
 * ------------------------------------------------------------------
 * 未登录时跳转登录页，并记录来源路径，登录成功后回跳。
 */
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../../services/api';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  if (!auth.getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
