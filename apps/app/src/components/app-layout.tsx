import { BarChart3, Clock, FolderTree, ListChecks, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', key: 'nav.timer', icon: Clock },
  { to: '/sessoes', key: 'nav.sessions', icon: ListChecks },
  { to: '/grupos', key: 'nav.groups', icon: FolderTree },
  { to: '/dashboard', key: 'nav.dashboard', icon: BarChart3 },
  { to: '/ajustes', key: 'nav.settings', icon: Settings },
];

export function AppLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-card p-4 md:flex">
        <span className="px-2 text-lg font-semibold">{t('app.name')}</span>
        <nav aria-label={t('nav.label')} className="flex flex-1 flex-col gap-1">
          {items.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
      </aside>

      <header className="flex items-center justify-between border-b bg-card px-4 py-2 md:hidden">
        <span className="text-lg font-semibold">{t('app.name')}</span>
        <ThemeToggle />
      </header>

      <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
        <Outlet />
      </main>

      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {items.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate">{t(key)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
