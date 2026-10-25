import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTheme, type Theme } from '@/lib/theme';

const options: { value: Theme; icon: typeof Sun; key: string }[] = [
  { value: 'light', icon: Sun, key: 'theme.light' },
  { value: 'dark', icon: Moon, key: 'theme.dark' },
  { value: 'system', icon: Monitor, key: 'theme.system' },
];

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <div role="group" aria-label={t('theme.toggle')} className="flex gap-1">
      {options.map(({ value, icon: Icon, key }) => (
        <Button
          key={value}
          size="icon"
          variant={theme === value ? 'secondary' : 'ghost'}
          aria-label={t(key)}
          aria-pressed={theme === value}
          title={t(key)}
          onClick={() => setTheme(value)}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}
