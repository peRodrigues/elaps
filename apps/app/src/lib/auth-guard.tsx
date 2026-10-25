import { Navigate, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';

/** Rotas filhas exigem sessão; sem ela vai para /entrar lembrando o destino. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div
        role="status"
        className="grid min-h-dvh place-items-center text-sm text-muted-foreground"
      >
        {t('auth.loading')}
      </div>
    );
  }
  if (!session) {
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/entrar" replace state={{ from }} />;
  }
  return <Outlet />;
}
