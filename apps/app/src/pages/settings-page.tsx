import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Download, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { signOut, useAuth } from '@/lib/auth';
import { useInstallPrompt } from '@/lib/install';
import { useProfile, useUpdateProfile } from '@/lib/profile';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; key: string }[] = [
  { value: 'light', icon: Sun, key: 'theme.light' },
  { value: 'dark', icon: Moon, key: 'theme.dark' },
  { value: 'system', icon: Monitor, key: 'theme.system' },
];

const MAX_LISTED = 80;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function TimezoneField() {
  const { t } = useTranslation();
  const profile = useProfile();
  const update = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const zones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const current = profile.data?.timezone;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replaceAll(' ', '_');
    return zones.filter((z) => z.toLowerCase().includes(q));
  }, [zones, query]);

  function choose(timezone: string) {
    setOpen(false);
    update.mutate(
      { timezone },
      {
        onSuccess: () => toast.success(t('settings.timezone.saved')),
        onError: () => toast.error(t('settings.timezone.failed')),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={t('settings.timezone.label')}
            disabled={!current}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{current ?? t('settings.loading')}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('settings.timezone.search')}
            aria-label={t('settings.timezone.search')}
          />
          <ul role="listbox" className="mt-2 max-h-64 overflow-y-auto">
            {matches.slice(0, MAX_LISTED).map((z) => (
              <li key={z} role="option" aria-selected={z === current}>
                <button
                  type="button"
                  onClick={() => choose(z)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                    z === current && 'font-medium',
                  )}
                >
                  <span className="truncate">{z}</span>
                  {z === current && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">
                {t('settings.timezone.none')}
              </li>
            )}
            {matches.length > MAX_LISTED && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('settings.timezone.refine', { count: matches.length - MAX_LISTED })}
              </li>
            )}
          </ul>
        </PopoverContent>
      </Popover>
      {current && deviceZone !== current && (
        <Button variant="secondary" className="self-start" onClick={() => choose(deviceZone)}>
          {t('settings.timezone.useDevice', { zone: deviceZone })}
        </Button>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const install = useInstallPrompt();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
      navigate('/entrar', { replace: true });
    } catch {
      toast.error(t('auth.errors.signOut'));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('pages.settings.title')}</h1>

      <Section title={t('settings.timezone.title')} hint={t('settings.timezone.hint')}>
        <TimezoneField />
      </Section>

      <Section title={t('settings.theme.title')} hint={t('settings.theme.hint')}>
        <div role="group" aria-label={t('settings.theme.title')} className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, icon: Icon, key }) => (
            <Button
              key={value}
              variant={theme === value ? 'default' : 'outline'}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              <Icon className="size-4" />
              {t(key)}
            </Button>
          ))}
        </div>
      </Section>

      {install && (
        <Section title={t('settings.install.title')} hint={t('settings.install.hint')}>
          <Button className="self-start" onClick={() => void install()}>
            <Download className="size-4" />
            {t('settings.install.button')}
          </Button>
        </Section>
      )}

      <Section title={t('settings.account.title')}>
        <p className="text-sm text-muted-foreground">
          {t('auth.signedInAs', { email: user?.email ?? '' })}
        </p>
        <Button variant="outline" className="self-start" onClick={onSignOut} disabled={busy}>
          <LogOut className="size-4" />
          {t('auth.signOut')}
        </Button>
      </Section>
    </div>
  );
}
