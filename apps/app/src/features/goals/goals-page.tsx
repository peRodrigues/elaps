import { useTranslation } from 'react-i18next';

/** Placeholder: outro card troca esta tela pela de metas. */
export function GoalsPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t('goals.placeholder.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('goals.placeholder.body')}</p>
    </div>
  );
}
