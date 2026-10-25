import { useTranslation } from 'react-i18next';

type PageName = 'timer' | 'sessions' | 'groups' | 'dashboard' | 'settings';

export function PlaceholderPage({ name }: { name: PageName }) {
  const { t } = useTranslation();
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t(`pages.${name}.title`)}</h1>
      <p className="mt-2 text-muted-foreground">{t(`pages.${name}.placeholder`)}</p>
    </section>
  );
}
