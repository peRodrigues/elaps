import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ProviderDisabledError,
  safeNext,
  sendMagicLink,
  signInWithGoogle,
  useAuth,
} from '@/lib/auth';

export function LoginPage() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const location = useLocation();
  const next = safeNext((location.state as { from?: string } | null)?.from);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!loading && session) return <Navigate to={next} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      await sendMagicLink(email.trim(), next);
      setSentTo(email.trim());
    } catch {
      toast.error(t('auth.errors.sendLink'));
    } finally {
      setSending(false);
    }
  }

  async function onGoogle() {
    try {
      await signInWithGoogle(next);
    } catch (error) {
      toast.error(
        t(
          error instanceof ProviderDisabledError
            ? 'auth.errors.googleDisabled'
            : 'auth.errors.google',
        ),
      );
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <span className="text-sm font-semibold text-muted-foreground">{t('app.name')}</span>
          <CardTitle>
            <h1 className="text-2xl">
              {sentTo ? t('auth.login.sentTitle') : t('auth.login.title')}
            </h1>
          </CardTitle>
          {!sentTo && <CardDescription>{t('auth.login.subtitle')}</CardDescription>}
        </CardHeader>
        <CardContent>
          {sentTo ? (
            <div className="flex flex-col gap-4">
              <p className="flex gap-3 text-sm">
                <MailCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                {t('auth.login.sentBody', { email: sentTo })}
              </p>
              <Button variant="outline" onClick={() => setSentTo(null)}>
                {t('auth.login.useAnotherEmail')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <Label htmlFor="email">{t('auth.login.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t('auth.login.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="submit" disabled={sending}>
                  {sending ? t('auth.login.sending') : t('auth.login.sendLink')}
                </Button>
              </form>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1" />
                {t('auth.login.or')}
                <Separator className="flex-1" />
              </div>
              <Button variant="outline" onClick={onGoogle}>
                <GoogleIcon />
                {t('auth.login.google')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
