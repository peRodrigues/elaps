import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { exchangeCode, lastLoginEmail, safeNext } from '@/lib/auth';

/** Retorno do magic link e do Google (PKCE): troca ?code= por sessão e segue para ?next=. */
export function LoginCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = params.get('code');
  const next = safeNext(params.get('next'));
  const email = lastLoginEmail();
  const [failed, setFailed] = useState(!code || params.has('error'));

  useEffect(() => {
    if (!code || params.has('error')) return;
    exchangeCode(code)
      .then(() => navigate(next, { replace: true }))
      .catch(() => setFailed(true));
  }, [code, next, navigate, params]);

  return (
    <main className="grid min-h-dvh place-items-center p-4 text-center">
      {failed ? (
        <div className="flex max-w-sm flex-col items-center gap-3">
          <h1 className="text-xl font-semibold">{t('auth.callback.failedTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.callback.failedBody')}</p>
          <p className="text-sm text-muted-foreground">{t('auth.callback.failedHint')}</p>
          <Button asChild>
            <Link to="/entrar" replace state={{ from: next }}>
              {email ? t('auth.callback.requestNewFor', { email }) : t('auth.callback.requestNew')}
            </Link>
          </Button>
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {t('auth.callback.working')}
        </p>
      )}
    </main>
  );
}
